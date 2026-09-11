"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireEmployee, requireStaff } from "@/lib/auth/session";
import { getMyEmployee } from "@/lib/files";

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export async function saveWorkLocation(formData: FormData) {
  const s = await requireStaff();
  const lat = Number(formData.get("latitude"));
  const lng = Number(formData.get("longitude"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("Latitud y longitud de la sede son obligatorias.");
  const db = createAdminClient();
  const { error } = await db.from("work_locations").insert({
    tenant_id: s.tenantId,
    name: String(formData.get("name") ?? "").trim() || "Sede",
    latitude: lat,
    longitude: lng,
    radius_meters: Number(formData.get("radius_meters") || 150),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/rrhh/asistencia");
}

export async function punch(formData: FormData) {
  const s = await requireEmployee();
  const me = await getMyEmployee(s);
  if (!me) throw new Error("Sin ficha de empleado.");
  const wanted = String(formData.get("punch_type") ?? "") === "out" ? "out" : "in";
  const lat = Number(formData.get("latitude"));
  const lng = Number(formData.get("longitude"));
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
    throw new Error("RRHH todavía no cargó sucursales. No se puede fichar.");
  }
  if (assigned && !sites.length) {
    throw new Error("Tu sucursal no tiene ubicación cargada. Pedile a RRHH que la complete.");
  }
  if (requireGps && (!Number.isFinite(lat) || !Number.isFinite(lng))) {
    throw new Error("Activá la ubicación del celular para fichar.");
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
      throw new Error(
        `Estás a ${Math.round(distance)} m de ${nearest?.name ?? "la sucursal"} (máximo ${radius} m). Tenés que fichar en ${assigned ? "tu sucursal" : "una sucursal de la empresa"}.`,
      );
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
  if (wanted === "in" && lastIsIn) throw new Error("Ya registraste la entrada. Ahora fichá la salida.");
  if (wanted === "out" && !lastIsIn) throw new Error("Primero tenés que fichar la entrada.");

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
    if (fallback.error) throw new Error(fallback.error.message);
  }
  revalidatePath("/empleado");
  revalidatePath("/empleado/fichaje");
  revalidatePath("/rrhh/asistencia");
}
