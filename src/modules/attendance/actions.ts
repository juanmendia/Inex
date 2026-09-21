"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireEmployee, requireStaff, requireSession } from "@/lib/auth/session";
import { FACE_MATCH_MAX, faceDistance, parseDescriptor } from "@/lib/face-match";
import { getMyEmployee, uploadPunchPhoto, notifyStaff, notifyUsers } from "@/lib/files";
import { atBuenosAires, baYmd, isPunchOut, laterHm, viaticNoveltyNote } from "@/lib/attendance";
import { roundMoney } from "@/lib/labels";
import { isStaff } from "@/lib/auth/roles";

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

function baToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

type HoursRow = { day_start?: string | null; day_end?: string | null; afternoon_start?: string | null; afternoon_end?: string | null };

function scheduledEnd(loc?: HoursRow | null, ag?: HoursRow | null) {
  return (
    laterHm(loc?.afternoon_end, loc?.day_end) || laterHm(ag?.afternoon_end, ag?.day_end) || "18:00"
  );
}

/** Pasada la medianoche BA, cierra entradas sin salida con la hora de fin de jornada. Viáticos no se cierran. */
export async function closeStaleOpenIns(opts?: { tenantId?: string; employeeId?: string }) {
  const db = createAdminClient();
  const today = baYmd();
  let q = db
    .from("attendance_records")
    .select("id, tenant_id, employee_id, punch_type, method, recorded_at, work_location_id")
    .gte("recorded_at", new Date(Date.now() - 8 * 86400000).toISOString())
    .order("recorded_at", { ascending: true })
    .limit(opts?.employeeId ? 40 : 8000);
  if (opts?.tenantId) q = q.eq("tenant_id", opts.tenantId);
  if (opts?.employeeId) q = q.eq("employee_id", opts.employeeId);
  const { data } = await q;
  type PunchRow = NonNullable<typeof data> extends (infer R)[] ? R : never;
  const byEmp = new Map<string, PunchRow[]>();
  for (const r of data ?? []) {
    const list = byEmp.get(r.employee_id) ?? [];
    list.push(r);
    byEmp.set(r.employee_id, list);
  }
  const opens: PunchRow[] = [];
  const repairs: { fake: PunchRow; inn: PunchRow }[] = [];
  for (const list of byEmp.values()) {
    let open: PunchRow | null = null;
    for (const p of list) {
      if (!isPunchOut(p)) {
        if (open && baYmd(open.recorded_at) < today) opens.push(open);
        open = p;
      } else {
        if (
          open &&
          p.method === "missing_out" &&
          new Date(p.recorded_at).getTime() - new Date(open.recorded_at).getTime() < 5 * 60_000 &&
          baYmd(open.recorded_at) < today
        ) {
          repairs.push({ fake: p, inn: open });
        }
        open = null;
      }
    }
    if (open && baYmd(open.recorded_at) < today) opens.push(open);
  }
  if (!opens.length && !repairs.length) return 0;

  const empIds = [...new Set([...opens, ...repairs.map((x) => x.inn)].map((r) => r.employee_id))];
  const tenantIds = [...new Set([...opens, ...repairs.map((x) => x.inn)].map((r) => r.tenant_id))];
  const [{ data: emps }, { data: locs }, { data: ags }, viaticRes] = await Promise.all([
    db.from("employees").select("id, work_location_id, agreement_id").in("id", empIds),
    db.from("work_locations").select("id, day_start, day_end, afternoon_start, afternoon_end").in("tenant_id", tenantIds),
    db.from("collective_agreements").select("id, day_start, day_end, afternoon_start, afternoon_end").in("tenant_id", tenantIds),
    db.from("viatic_days").select("employee_id, day, status").in("employee_id", empIds),
  ]);
  const empMap = new Map((emps ?? []).map((e) => [e.id, e]));
  const locMap = new Map((locs ?? []).map((l) => [l.id, l]));
  const agMap = new Map((ags ?? []).map((a) => [a.id, a]));
  const viatics = viaticRes.error ? [] : (viaticRes.data ?? []);

  function isViaticDay(employeeId: string, ymd: string) {
    return viatics.some(
      (v) => v.employee_id === employeeId && String(v.day).slice(0, 10) === ymd && (v.status ?? "approved") === "approved",
    );
  }

  const nowIso = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];
  let n = 0;

  async function closeFrom(r: (typeof opens)[number], existingId?: string) {
    const ymd = baYmd(r.recorded_at);
    if (isViaticDay(r.employee_id, ymd)) {
      if (existingId) await db.from("attendance_records").delete().eq("id", existingId);
      return;
    }
    const emp = empMap.get(r.employee_id);
    const locId = r.work_location_id || emp?.work_location_id;
    const hm = scheduledEnd(locId ? locMap.get(locId) : null, emp?.agreement_id ? agMap.get(emp.agreement_id) : null);
    const outAt = atBuenosAires(ymd, hm);
    if (outAt.getTime() <= new Date(r.recorded_at).getTime()) return;
    const body = {
      tenant_id: r.tenant_id,
      employee_id: r.employee_id,
      work_location_id: locId ?? null,
      method: "scheduled_out",
      punch_type: "out",
      recorded_at: outAt.toISOString(),
      server_recorded_at: nowIso,
    };
    if (existingId) {
      await db.from("attendance_records").update(body).eq("id", existingId);
      n += 1;
    } else rows.push(body);
  }

  for (const r of opens) await closeFrom(r);
  for (const x of repairs) await closeFrom(x.inn, x.fake.id);
  if (rows.length) {
    await db.from("attendance_records").insert(rows);
    n += rows.length;
  }
  return n;
}

/** Foto de referencia en la ficha, o la primera que ya quedó en un fichaje. */
export async function employeeHasFacePhoto(employeeId: string) {
  const db = createAdminClient();
  const { data: emp } = await db.from("employees").select("face_photo_path").eq("id", employeeId).maybeSingle();
  if (emp?.face_photo_path) return true;
  const { data: rec } = await db
    .from("attendance_records")
    .select("photo_path")
    .eq("employee_id", employeeId)
    .not("photo_path", "is", null)
    .limit(1)
    .maybeSingle();
  if (!rec?.photo_path) return false;
  const up = await db
    .from("employees")
    .update({ face_photo_path: rec.photo_path, face_photo_validated: false })
    .eq("id", employeeId);
  if (up.error) await db.from("employees").update({ face_photo_path: rec.photo_path }).eq("id", employeeId);
  return true;
}

export async function saveWorkLocation(_prev: string | null, formData: FormData): Promise<string | null> {
  const s = await requireStaff();
  const lat = Number(formData.get("latitude"));
  const lng = Number(formData.get("longitude"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "Latitud y longitud son obligatorias.";
  const id = String(formData.get("id") ?? "").trim();
  const hm = (name: string) => {
    const v = String(formData.get(name) ?? "").trim();
    return v || null;
  };
  const row = {
    name: String(formData.get("name") ?? "").trim() || "Sede",
    latitude: lat,
    longitude: lng,
    radius_meters: Number(formData.get("radius_meters") || 150),
    day_start: hm("day_start"),
    day_end: hm("day_end"),
    afternoon_start: hm("afternoon_start"),
    afternoon_end: hm("afternoon_end"),
  };
  const db = createAdminClient();
  if (id) {
    const { error } = await db.from("work_locations").update(row).eq("id", id).eq("tenant_id", s.tenantId!);
    if (error) {
      const { error: e2 } = await db
        .from("work_locations")
        .update({ name: row.name, latitude: row.latitude, longitude: row.longitude, radius_meters: row.radius_meters })
        .eq("id", id)
        .eq("tenant_id", s.tenantId!);
      if (e2) return e2.message + " Corré 0018_sucursal_horario.sql.";
    }
  } else {
    const { error } = await db.from("work_locations").insert({ ...row, tenant_id: s.tenantId });
    if (error) {
      const { error: e2 } = await db.from("work_locations").insert({
        tenant_id: s.tenantId,
        name: row.name,
        latitude: row.latitude,
        longitude: row.longitude,
        radius_meters: row.radius_meters,
      });
      if (e2) return e2.message;
    }
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
  const newShot = photo instanceof File && photo.size >= 80 ? photo : null;
  if (!newShot) return "Sacate una foto de la cara para fichar.";
  const incoming = parseDescriptor(String(formData.get("face_descriptor") ?? ""));
  if (!incoming) return "No se detectó una cara. Mirá a la cámara con buena luz y volvé a intentar.";
  const stored = parseDescriptor((me as { face_descriptor?: unknown }).face_descriptor);
  if (stored && faceDistance(stored, incoming) > FACE_MATCH_MAX) {
    return "La cara no coincide con tu foto de referencia. Si cambiaste de look, pedile a RRHH que borre la foto y volvé a enrolarte.";
  }
  if (!deviceId) return "Este celular no se identificó. Recargá la página e intentá de nuevo.";
  const db = createAdminClient();
  await closeStaleOpenIns({ tenantId: s.tenantId!, employeeId: me.id });
  const [{ data: owner }, { data: otherFaces }] = await Promise.all([
    db
      .from("employees")
      .select("id")
      .eq("tenant_id", s.tenantId!)
      .eq("punch_device_id", deviceId)
      .neq("id", me.id)
      .maybeSingle(),
    db
      .from("employees")
      .select("face_descriptor")
      .eq("tenant_id", s.tenantId!)
      .neq("id", me.id)
      .not("face_descriptor", "is", null),
  ]);
  if (owner) {
    return "Este celular ya está usado por otro empleado. Cada usuario tiene que fichar desde su propio teléfono.";
  }
  for (const row of otherFaces ?? []) {
    const other = parseDescriptor(row.face_descriptor);
    if (other && faceDistance(other, incoming) <= FACE_MATCH_MAX) {
      return "Esta cara ya está registrada en otro usuario. No podés fichar con esa cuenta.";
    }
  }

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

  const { data: today } = await db
    .from("attendance_records")
    .select("punch_type, method")
    .eq("employee_id", me.id)
    .gte("recorded_at", `${baToday()}T00:00:00-03:00`)
    .order("recorded_at", { ascending: false })
    .limit(1);
  const last = today?.[0];
  const lastIsOut = Boolean(last && isPunchOut(last));
  const lastIsIn = Boolean(last) && !lastIsOut;
  if (wanted === "in" && lastIsIn) return "Ya registraste la entrada. Ahora fichá la salida.";
  if (wanted === "out" && !lastIsIn) return "Primero tenés que fichar la entrada.";

  const shot = newShot ? await uploadPunchPhoto({ tenantId: s.tenantId!, file: newShot }) : null;
  if (shot && "error" in shot && shot.error) return shot.error;
  const photoPath = shot && "path" in shot ? shot.path : null;

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
  await db.from("employees").update({ punch_device_id: deviceId }).eq("id", me.id);
  const face = (me as { face_photo_path?: string | null }).face_photo_path;
  const facePatch: Record<string, unknown> = {};
  if (!face && photoPath) {
    facePatch.face_photo_path = photoPath;
    facePatch.face_photo_validated = false;
  }
  if (!stored) facePatch.face_descriptor = incoming;
  if (Object.keys(facePatch).length) {
    const faceUp = await db.from("employees").update(facePatch).eq("id", me.id);
    if (faceUp.error && facePatch.face_photo_path) {
      await db.from("employees").update({ face_photo_path: facePatch.face_photo_path }).eq("id", me.id);
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
  if (!inAt && !outAt) return "Cargá entrada, salida, o las dos.";
  const inDate = inAt ? new Date(inAt) : null;
  const outDate = outAt ? new Date(outAt) : null;
  if (inAt && (!inDate || Number.isNaN(inDate.getTime()))) return "Hora de entrada inválida.";
  if (outAt && (!outDate || Number.isNaN(outDate.getTime()))) return "Hora de salida inválida.";
  if (inDate && outDate && outDate <= inDate) return "La salida tiene que ser después de la entrada.";
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
  async function put(kind: "in" | "out", at: Date) {
    const ins = await db.from("attendance_records").insert({
      ...base,
      punch_type: kind,
      recorded_at: at.toISOString(),
      server_recorded_at: new Date().toISOString(),
    });
    if (ins.error) {
      const fb = await db.from("attendance_records").insert({
        tenant_id: s.tenantId,
        employee_id: employeeId,
        method: kind === "in" ? "hr_manual:in" : "hr_manual:out",
        recorded_at: at.toISOString(),
        server_recorded_at: new Date().toISOString(),
      });
      if (fb.error) throw new Error(fb.error.message);
    }
  }
  try {
    if (inDate) await put("in", inDate);
    if (outDate) await put("out", outDate);
  } catch (e) {
    return e instanceof Error ? e.message : "No se pudo cargar.";
  }
  revalidatePath("/rrhh/asistencia");
  if (inDate && outDate) return "Entrada y salida cargadas.";
  if (inDate) return "Entrada cargada. La salida la podés cargar después.";
  return "Salida cargada.";
}

export async function deleteAttendancePunch(formData: FormData) {
  const s = await requireStaff();
  const ids = [
    String(formData.get("id") ?? ""),
    ...String(formData.get("ids") ?? "").split(","),
  ].map((x) => x.trim()).filter(Boolean);
  if (!ids.length) return;
  const db = createAdminClient();
  const { data: rows } = await db
    .from("attendance_records")
    .select("id, photo_path")
    .eq("tenant_id", s.tenantId!)
    .in("id", ids);
  for (const data of rows ?? []) {
    if (data.photo_path) {
      const { data: face } = await db.from("employees").select("id").eq("face_photo_path", data.photo_path).maybeSingle();
      if (!face) await db.storage.from("documents").remove([data.photo_path]);
    }
  }
  await db.from("attendance_records").delete().eq("tenant_id", s.tenantId!).in("id", ids);
  revalidatePath("/rrhh/asistencia");
  revalidatePath("/empleado");
  revalidatePath("/empleado/fichaje");
}

/** Borra fotos de fichaje de más de 7 días. No toca la foto de referencia de la ficha. */
export async function purgeOldPunchPhotos() {
  const db = createAdminClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const { data: faces } = await db.from("employees").select("face_photo_path");
  const keep = new Set((faces ?? []).map((f) => f.face_photo_path).filter(Boolean) as string[]);
  let removed = 0;
  for (;;) {
    const { data: rows } = await db
      .from("attendance_records")
      .select("id, photo_path")
      .not("photo_path", "is", null)
      .lt("recorded_at", cutoff.toISOString())
      .limit(80);
    if (!rows?.length) break;
    const batch = rows.filter((r) => r.photo_path && !keep.has(r.photo_path));
    if (!batch.length) break;
    const paths = [...new Set(batch.map((r) => r.photo_path as string))];
    await db.storage.from("documents").remove(paths);
    await db.from("attendance_records").update({ photo_path: null }).in(
      "id",
      batch.map((r) => r.id),
    );
    removed += batch.length;
  }
  return removed;
}

function touchViatic() {
  revalidatePath("/empleado/fichaje");
  revalidatePath("/rrhh/asistencia");
  revalidatePath("/rrhh/liquidacion");
  revalidatePath("/rrhh/viaticos");
}

async function dropViaticNovelty(db: ReturnType<typeof createAdminClient>, tenantId: string, employeeId: string, day: string) {
  await db.from("payroll_novelties").delete().eq("tenant_id", tenantId).eq("employee_id", employeeId).eq("note", viaticNoveltyNote(day));
}

async function putViaticOnPayslip(
  db: ReturnType<typeof createAdminClient>,
  tenantId: string,
  employeeId: string,
  day: string,
) {
  await dropViaticNovelty(db, tenantId, employeeId, day);
  const { data: emp } = await db.from("employees").select("base_salary").eq("id", employeeId).maybeSingle();
  const amount = roundMoney(Number(emp?.base_salary ?? 0) / 30);
  if (amount <= 0) return;
  const [y, m] = day.split("-").map(Number);
  await db.from("payroll_novelties").insert({
    tenant_id: tenantId,
    employee_id: employeeId,
    period_year: y,
    period_month: m,
    concept: "210 VIATICO",
    amount,
    status: "approved",
    note: viaticNoveltyNote(day),
  });
}

export async function declareViaticDay(_prev: string | null, formData: FormData): Promise<string | null> {
  const s = await requireSession();
  const db = createAdminClient();
  const me = await getMyEmployee(s);
  let employeeId = String(formData.get("employee_id") ?? "").trim();
  if (!employeeId && me) employeeId = me.id;
  if (!employeeId) return "Elegí el empleado.";
  if (!isStaff(s.roles) && me?.id !== employeeId) return "No podés cargar el viático de otra persona.";
  const day = String(formData.get("day") ?? "").slice(0, 10) || baYmd();
  const note = String(formData.get("note") ?? "").trim() || null;
  const payVia = String(formData.get("pay_via") ?? "recibo") === "cash" ? "cash" : "recibo";
  const staffCreates = isStaff(s.roles);
  const status = staffCreates ? "approved" : "pending";
  const { error } = await db.from("viatic_days").insert({
    tenant_id: s.tenantId,
    employee_id: employeeId,
    day,
    note,
    pay_via: payVia,
    status,
    created_by: s.userId,
  });
  if (error) {
    if (error.code === "23505") return "Ese día ya está de viático.";
    return /viatic_days|schema cache|pay_via|status/i.test(error.message)
      ? "Corré 0023, 0024 y 0025_viatic_status.sql en Supabase."
      : error.message;
  }
  if (status === "approved" && payVia === "recibo") await putViaticOnPayslip(db, s.tenantId!, employeeId, day);
  if (!staffCreates) {
    await notifyStaff(
      s.tenantId!,
      "Pedido de viático",
      `${me?.first_name ?? ""} ${me?.last_name ?? ""} · ${day} · ${payVia === "cash" ? "pago aparte" : "recibo"}`,
      "/rrhh/viaticos",
    );
  }
  touchViatic();
  return staffCreates
    ? payVia === "cash"
      ? "Viático autorizado: pago aparte, no va al recibo."
      : "Viático autorizado: va en el recibo del mes."
    : "Pedido enviado. RRHH tiene que autorizarlo (caja / disponibilidad).";
}

export async function cancelViaticDay(formData: FormData) {
  const s = await requireSession();
  const db = createAdminClient();
  const me = await getMyEmployee(s);
  let employeeId = String(formData.get("employee_id") ?? "").trim();
  if (!employeeId && me) employeeId = me.id;
  const day = String(formData.get("day") ?? "").slice(0, 10);
  if (!employeeId || !day) return;
  if (!isStaff(s.roles) && me?.id !== employeeId) return;
  if (!isStaff(s.roles)) {
    const { data: row } = await db
      .from("viatic_days")
      .select("status, paid_at")
      .eq("employee_id", employeeId)
      .eq("day", day)
      .eq("tenant_id", s.tenantId!)
      .maybeSingle();
    if (!row || row.paid_at || row.status === "approved") return;
  }
  await db.from("viatic_days").delete().eq("employee_id", employeeId).eq("day", day).eq("tenant_id", s.tenantId!);
  await dropViaticNovelty(db, s.tenantId!, employeeId, day);
  touchViatic();
}

export async function setViaticPaid(formData: FormData) {
  const s = await requireStaff();
  const id = String(formData.get("id") ?? "");
  const paid = String(formData.get("paid") ?? "") === "1";
  if (!id) return;
  const db = createAdminClient();
  const { data: row } = await db
    .from("viatic_days")
    .select("id, employee_id, day, pay_via, status")
    .eq("id", id)
    .eq("tenant_id", s.tenantId!)
    .maybeSingle();
  if (!row || (row as { status?: string }).status === "pending") return;
  const day = String(row.day).slice(0, 10);
  await db
    .from("viatic_days")
    .update({ paid_at: paid ? new Date().toISOString() : null })
    .eq("id", id);
  if (paid) await dropViaticNovelty(db, s.tenantId!, row.employee_id, day);
  else if (row.pay_via !== "cash") await putViaticOnPayslip(db, s.tenantId!, row.employee_id, day);
  touchViatic();
}

export async function decideViatic(formData: FormData) {
  const s = await requireStaff();
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!id || (decision !== "approved" && decision !== "rejected")) return;
  const db = createAdminClient();
  const { data: row } = await db
    .from("viatic_days")
    .select("id, employee_id, day, pay_via, status")
    .eq("id", id)
    .eq("tenant_id", s.tenantId!)
    .maybeSingle();
  if (!row || row.status !== "pending") return;
  const day = String(row.day).slice(0, 10);
  await db.from("viatic_days").update({ status: decision }).eq("id", id);
  if (decision === "approved" && row.pay_via === "recibo") {
    await putViaticOnPayslip(db, s.tenantId!, row.employee_id, day);
  } else {
    await dropViaticNovelty(db, s.tenantId!, row.employee_id, day);
  }
  const { data: emp } = await db.from("employees").select("user_id").eq("id", row.employee_id).maybeSingle();
  if (emp?.user_id) {
    await notifyUsers(
      s.tenantId!,
      [emp.user_id],
      decision === "approved" ? "Viático autorizado" : "Viático no autorizado",
      decision === "approved" ? `${day} · listo para salir` : `${day} · no hay autorización (caja / disponibilidad)`,
      "/empleado/fichaje",
    );
  }
  touchViatic();
}
