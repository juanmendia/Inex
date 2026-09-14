import { Shell } from "@/components/shell";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { signedUrl } from "@/lib/files";
import { ManualAttendanceForm } from "./manual-form";

export default async function AsistenciaRrhh() {
  const s = await requireStaff();
  const db = createAdminClient();
  const start = new Date();
  start.setDate(start.getDate() - 14);
  start.setHours(0, 0, 0, 0);
  const peopleQ = db
    .from("employees")
    .select("id, first_name, last_name, employee_number")
    .eq("tenant_id", s.tenantId!)
    .eq("status", "active")
    .order("last_name");
  const countQ = db.from("employees").select("id", { count: "exact", head: true }).eq("tenant_id", s.tenantId!).eq("status", "active");
  const full = await db
    .from("attendance_records")
    .select(
      "id, recorded_at, method, punch_type, employee_id, latitude, longitude, site_latitude, site_longitude, distance_meters, within_geofence, photo_path, device_id, work_locations(name), employees(first_name, last_name)",
    )
    .eq("tenant_id", s.tenantId!)
    .gte("recorded_at", start.toISOString())
    .order("recorded_at", { ascending: false })
    .limit(200);
  const [{ data: records }, { data: people }, { count: emps }] = await Promise.all([
    full.error
      ? db
          .from("attendance_records")
          .select(
            "id, recorded_at, method, punch_type, employee_id, latitude, longitude, site_latitude, site_longitude, distance_meters, within_geofence, work_locations(name), employees(first_name, last_name)",
          )
          .eq("tenant_id", s.tenantId!)
          .gte("recorded_at", start.toISOString())
          .order("recorded_at", { ascending: false })
          .limit(200)
      : Promise.resolve(full),
    peopleQ,
    countQ,
  ]);

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const unique = new Set(
    (records ?? []).filter((r) => new Date(r.recorded_at) >= dayStart).map((r) => r.employee_id),
  );

  const photos = new Map<string, string>();
  await Promise.all(
    (records ?? []).slice(0, 60).map(async (r) => {
      const path = (r as { photo_path?: string | null }).photo_path;
      if (!path) return;
      try {
        photos.set(r.id, await signedUrl(path));
      } catch {
        /* ponytail: URL firmada; si el storage falla, igual se ve el evento */
      }
    }),
  );

  return (
    <Shell area="rrhh" title="Asistencia" session={s}>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
          <p className="text-sm text-zinc-500">Activos</p>
          <p className="text-2xl font-semibold">{emps ?? 0}</p>
        </div>
        <div className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
          <p className="text-sm text-zinc-500">Ficharon hoy</p>
          <p className="text-2xl font-semibold">{unique.size}</p>
        </div>
        <div className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
          <p className="text-sm text-zinc-500">Eventos (14 días)</p>
          <p className="text-2xl font-semibold">{records?.length ?? 0}</p>
        </div>
      </div>

      <p className="mt-4 text-sm text-zinc-600">
        El fichaje pide GPS en sucursal, foto de la cara y el mismo celular. Si alguien presta usuario y van con
        otro teléfono, no entra. Si cambió de celular, desvinculalo en la ficha.
      </p>

      <ManualAttendanceForm employees={people ?? []} />

      <ul className="mt-4 divide-y rounded-xl bg-white ring-1 ring-zinc-200">
        {(records ?? []).map((r) => {
          const emp = r.employees as { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
          const e = Array.isArray(emp) ? emp[0] : emp;
          const loc = r.work_locations as { name: string } | { name: string }[] | null;
          const branch = Array.isArray(loc) ? loc[0]?.name : loc?.name;
          const out = r.punch_type === "out" || String(r.method).endsWith(":out");
          return (
            <li key={r.id} className="flex gap-3 px-4 py-3 text-sm">
              {photos.get(r.id) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photos.get(r.id)} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
              ) : null}
              <div>
              {e ? `${e.last_name}, ${e.first_name}` : r.employee_id} · {out ? "Salida" : "Entrada"}
              {branch ? ` · ${branch}` : ""} · {new Date(r.recorded_at).toLocaleString("es-AR")}
              {r.latitude != null ? (
                <p className="text-xs text-zinc-500">
                  Empleado {r.latitude.toFixed(5)}, {r.longitude?.toFixed(5)}
                  {branch ? ` · sucursal ${branch}` : ""}
                  {r.distance_meters != null ? ` · ${r.distance_meters} m` : ""}
                </p>
              ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}
