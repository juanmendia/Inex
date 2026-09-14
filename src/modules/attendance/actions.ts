"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireEmployee, requireStaff } from "@/lib/auth/session";
import { getMyEmployee, uploadPunchPhoto } from "@/lib/files";

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function revalidateLocations() {
  revalidatePath("/rrhh/asistencia");
  revalidatePath("/rrhh/configuracion");
  revalidatePath("/rrhh/empleados");
}

export async function saveWorkLocation(_prev: string | null, formData: FormData): Promise<string | null> {
  const s = await requireStaff();
  const lat = Number(formData.get("latitude"));
  const lng = Number(formData.get("longitude"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "Latitud y longitud son obligatorias.";
  const id = String(formData.get("id") ?? "").trim();
  const row = {
    name: String(formData.get("name") ?? "").trim() || "Sede",
    latitude: lat,
    longitude: lng,
    radius_meters: Number(formData.get("radius_meters") || 150),
  };
  const db = createAdminClient();
  if (id) {
    const { error } = await db.from("work_locations").update(row).eq("id", id).eq("tenant_id", s.tenantId!);
    if (error) return error.message;
  } else {
    const { error } = await db.from("work_locations").insert({ ...row, tenant_id: s.tenantId });
    if (error) return error.message;
  }
  revalidateLocations();
  return id ? "Sucursal actualizada." : "Sucursal agregada.";
}

export async function deleteWorkLocation(formData: FormData) {
  const s = await requireStaff();
  const id = String(formData.get("id"));
  const db = createAdminClient();
  await db.from("employees").update({ work_location_id: null }).eq("work_location_id", id).eq("tenant_id", s.tenantId!);
  await db.from("work_locations").delete().eq("id", id).eq("tenant_id", s.tenantId!);
  revalidateLocations();
}

export async function punch(formData: FormData): Promise<string | null> {
  const s = await requireEmployee();
  const me = await getMyEmployee(s);
  if (!me) return "Sin ficha de empleado.";
  const wanted = String(formData.get("punch_type") ?? "") === "out" ? "out" : "in";
  const lat = Number(formData.get("latitude"));
  const lng = Number(formData.get("longitude"));
  const deviceId = String(formData.get("device_id") ?? "").trim();
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size < 80) {
    return "Tenés que sacarte una foto al fichar. Así RRHH ve que sos vos.";
  }
  if (!deviceId) return "Este celular no se identificó. Recargá la página e intentá de nuevo.";
  const bound = (me as { punch_device_id?: string | null }).punch_device_id;
  if (bound && bound !== deviceId) {
    return "Este usuario ya está atado a otro celular. Pedile a RRHH que lo desvincule si cambiaste de teléfono.";
  }
  const db = createAdminClient();

  const [{ data: settings }, { data: locations }] = await Promise.all([
    db.from("tenant_settings").select("require_mobile_punch").eq("tenant_id", s.tenantId!).maybeSingle(),
    db.from("work_locations").select("*").eq("tenant_id", s.tenantId!),
  ]);
  const requireGps = Boolean(settings?.require_mobile_punch) || Boolean(locations?.length);
  const allSites = (locations ?? []).filter((loc) => loc.latitude != null && loc.longitude != null);
  const assigned = (me as { work_location_id?: string | null }).work_location_id;
  const sites = assigned ? allSites.filter((loc) => loc.id === assigned) : allSites;

  if (requireGps && !allSites.length) {
    return "RRHH todavía no cargó sucursales. No se puede fichar.";
  }
  if (assigned && !sites.length) {
    return "Tu sucursal no tiene ubicación cargada. Pedile a RRHH que la complete.";
  }
  if (requireGps && (!Number.isFinite(lat) || !Number.isFinite(lng))) {
    return "Activá la ubicación del celular para fichar.";
  }

  let nearest: (typeof sites)[number] | null = null;
  let distance = 0;
  if (sites.length && Number.isFinite(lat) && Number.isFinite(lng)) {
    for (const loc of sites) {
      const d = haversineMeters({ lat, lng }, { lat: Number(loc.latitude), lng: Number(loc.longitude) });
      if (!nearest || d < distance) {
        nearest = loc;
        distance = d;
      }
    }
    const radius = Number(nearest?.radius_meters ?? 150);
    if (distance > radius) {
      return `Estás a ${Math.round(distance)} m de ${nearest?.name ?? "la sucursal"} (máximo ${radius} m). En la PC la ubicación suele ser imprecisa: fichá desde el celular o pedile a RRHH que suba los metros de radio de la sucursal.`;
    }
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { data: today } = await db
    .from("attendance_records")
    .select("punch_type, method")
    .eq("employee_id", me.id)
    .gte("recorded_at", start.toISOString())
    .order("recorded_at", { ascending: false })
    .limit(1);
  const last = today?.[0];
  const lastIsOut = Boolean(
    last && (last.punch_type === "out" || String(last.method ?? "").endsWith(":out")),
  );
  const lastIsIn = Boolean(last) && !lastIsOut;
  if (wanted === "in" && lastIsIn) return "Ya registraste la entrada. Ahora fichá la salida.";
  if (wanted === "out" && !lastIsIn) return "Primero tenés que fichar la entrada.";

  const shot = await uploadPunchPhoto({ tenantId: s.tenantId!, file: photo });
  if ("error" in shot && shot.error) return shot.error;
  const photoPath = "path" in shot ? shot.path : null;

  const row = {
    tenant_id: s.tenantId,
    employee_id: me.id,
    method: "mobile_gps",
    punch_type: wanted,
    recorded_at: new Date().toISOString(),
    server_recorded_at: new Date().toISOString(),
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    work_location_id: nearest?.id ?? null,
    site_latitude: nearest ? Number(nearest.latitude) : null,
    site_longitude: nearest ? Number(nearest.longitude) : null,
    distance_meters: nearest ? Math.round(distance) : null,
    within_geofence: Boolean(nearest),
    photo_path: photoPath,
    device_id: deviceId,
  };
  const { error } = await db.from("attendance_records").insert(row);
  if (error) {
    const fallback = await db.from("attendance_records").insert({
      tenant_id: row.tenant_id,
      employee_id: row.employee_id,
      method: wanted === "in" ? "mobile_gps:in" : "mobile_gps:out",
      recorded_at: row.recorded_at,
      server_recorded_at: row.server_recorded_at,
      latitude: row.latitude,
      longitude: row.longitude,
    });
    if (fallback.error) return fallback.error.message;
  }
  if (!bound) {
    await db.from("employees").update({ punch_device_id: deviceId }).eq("id", me.id);
  }
  const face = (me as { face_photo_path?: string | null }).face_photo_path;
  if (!face && photoPath) {
    const faceUp = await db.from("employees").update({ face_photo_path: photoPath, face_photo_validated: false }).eq("id", me.id);
    if (faceUp.error) {
      await db.from("employees").update({ face_photo_path: photoPath }).eq("id", me.id);
    }
  }
  revalidatePath("/empleado");
  revalidatePath("/empleado/fichaje");
  revalidatePath("/rrhh/asistencia");
  return null;
}

export async function manualAttendance(_prev: string | null, formData: FormData): Promise<string | null> {
  const s = await requireStaff();
  const employeeId = String(formData.get("employee_id") ?? "");
  const inAt = String(formData.get("in_at") ?? "").trim();
  const outAt = String(formData.get("out_at") ?? "").trim();
  if (!employeeId) return "Elegí un empleado.";
  if (!inAt) return "Indicá hora de entrada.";
  const inDate = new Date(inAt);
  if (Number.isNaN(inDate.getTime())) return "Hora de entrada inválida.";
  let outDate: Date | null = null;
  if (outAt) {
    outDate = new Date(outAt);
    if (Number.isNaN(outDate.getTime())) return "Hora de salida inválida.";
    if (outDate <= inDate) return "La salida tiene que ser después de la entrada.";
  }
  const db = createAdminClient();
  const { data: emp } = await db
    .from("employees")
    .select("id")
    .eq("id", employeeId)
    .eq("tenant_id", s.tenantId!)
    .maybeSingle();
  if (!emp) return "Empleado no encontrado.";

  const base = {
    tenant_id: s.tenantId,
    employee_id: employeeId,
    method: "hr_manual",
    latitude: null,
    longitude: null,
    within_geofence: false,
  };
  const insIn = await db.from("attendance_records").insert({
    ...base,
    punch_type: "in",
    recorded_at: inDate.toISOString(),
    server_recorded_at: new Date().toISOString(),
  });
  if (insIn.error) {
    const fb = await db.from("attendance_records").insert({
      tenant_id: s.tenantId,
      employee_id: employeeId,
      method: "hr_manual:in",
      recorded_at: inDate.toISOString(),
      server_recorded_at: new Date().toISOString(),
    });
    if (fb.error) return fb.error.message;
  }
  if (outDate) {
    const insOut = await db.from("attendance_records").insert({
      ...base,
      punch_type: "out",
      recorded_at: outDate.toISOString(),
      server_recorded_at: new Date().toISOString(),
    });
    if (insOut.error) {
      await db.from("attendance_records").insert({
        tenant_id: s.tenantId,
        employee_id: employeeId,
        method: "hr_manual:out",
        recorded_at: outDate.toISOString(),
        server_recorded_at: new Date().toISOString(),
      });
    }
  }
  revalidatePath("/rrhh/asistencia");
  return outDate ? "Presente cargado: entrada y salida." : "Entrada cargada. Podés cargar la salida después.";
}
