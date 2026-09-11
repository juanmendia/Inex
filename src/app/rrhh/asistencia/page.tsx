import { Shell } from "@/components/shell";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveWorkLocation } from "@/modules/attendance/actions";

export default async function AsistenciaRrhh() {
  const s = await requireStaff();
  const db = createAdminClient();
  const start = new Date();
  start.setDate(start.getDate() - 14);
  start.setHours(0, 0, 0, 0);
  const [{ data: records }, { data: locations }, { count: emps }] = await Promise.all([
    db
      .from("attendance_records")
      .select(
        "id, recorded_at, method, punch_type, employee_id, latitude, longitude, site_latitude, site_longitude, distance_meters, within_geofence, work_locations(name), employees(first_name, last_name)",
      )
      .eq("tenant_id", s.tenantId!)
      .gte("recorded_at", start.toISOString())
      .order("recorded_at", { ascending: false })
      .limit(200),
    db.from("work_locations").select("*").eq("tenant_id", s.tenantId!),
    db.from("employees").select("id", { count: "exact", head: true }).eq("tenant_id", s.tenantId!).eq("status", "active"),
  ]);

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const unique = new Set(
    (records ?? []).filter((r) => new Date(r.recorded_at) >= dayStart).map((r) => r.employee_id),
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

      <form action={saveWorkLocation} className="mt-6 grid gap-2 rounded-xl bg-white p-4 ring-1 ring-zinc-200 md:grid-cols-4">
        <p className="text-xs tracking-widest uppercase text-zinc-500 md:col-span-4">Sucursales</p>
        <input name="name" placeholder="Nombre (Palermo, Centro…)" className="rounded-lg border px-3 py-2 text-sm" />
        <input name="latitude" required placeholder="Latitud" className="rounded-lg border px-3 py-2 text-sm" />
        <input name="longitude" required placeholder="Longitud" className="rounded-lg border px-3 py-2 text-sm" />
        <input name="radius_meters" placeholder="Radio m" defaultValue="150" className="rounded-lg border px-3 py-2 text-sm" />
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white md:col-span-4">Agregar sucursal</button>
      </form>
      <ul className="mt-3 text-xs text-zinc-500">
        {(locations ?? []).length === 0 ? (
          <li>Sin sucursales: el empleado no va a poder fichar si exigís GPS.</li>
        ) : (
          (locations ?? []).map((l) => (
            <li key={l.id}>
              {l.name}: {l.latitude}, {l.longitude} · radio {l.radius_meters ?? 150} m
            </li>
          ))
        )}
      </ul>

      <ul className="mt-4 divide-y rounded-xl bg-white ring-1 ring-zinc-200">
        {(records ?? []).map((r) => {
          const emp = r.employees as { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
          const e = Array.isArray(emp) ? emp[0] : emp;
          const loc = r.work_locations as { name: string } | { name: string }[] | null;
          const branch = Array.isArray(loc) ? loc[0]?.name : loc?.name;
          const out = r.punch_type === "out" || String(r.method).endsWith(":out");
          return (
            <li key={r.id} className="px-4 py-3 text-sm">
              {e ? `${e.last_name}, ${e.first_name}` : r.employee_id} · {out ? "Salida" : "Entrada"}
              {branch ? ` · ${branch}` : ""} · {new Date(r.recorded_at).toLocaleString("es-AR")}
              {r.latitude != null ? (
                <p className="text-xs text-zinc-500">
                  Empleado {r.latitude.toFixed(5)}, {r.longitude?.toFixed(5)}
                  {branch ? ` · sucursal ${branch}` : ""}
                  {r.distance_meters != null ? ` · ${r.distance_meters} m` : ""}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}
