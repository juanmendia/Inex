import { Shell } from "@/components/shell";
import { PunchPad } from "@/components/punch-button";
import { requireEmployee } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyEmployee } from "@/lib/files";
import { baYmd } from "@/lib/attendance";
import { employeeHasFacePhoto } from "@/modules/attendance/actions";
import { ViaticForm } from "./viatic-form";

export default async function FichajePage() {
  const s = await requireEmployee();
  const me = await getMyEmployee(s);
  const db = createAdminClient();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { data: today } = me
    ? await db
        .from("attendance_records")
        .select("id, recorded_at, method, punch_type, latitude, longitude, site_latitude, site_longitude, distance_meters")
        .eq("employee_id", me.id)
        .gte("recorded_at", start.toISOString())
        .order("recorded_at")
    : { data: [] };

  const todayYmd = baYmd();
  const { data: viaticToday } = me
    ? await db.from("viatic_days").select("id, pay_via, paid_at, status").eq("employee_id", me.id).eq("day", todayYmd).maybeSingle()
    : { data: null };
  const last = today?.length ? today[today.length - 1] : null;
  const lastOut = last && (last.punch_type === "out" || String(last.method).endsWith(":out"));
  const next = !last || lastOut ? "in" : "out";
  const hasFace = me ? await employeeHasFacePhoto(me.id) : false;

  return (
    <Shell area="empleado" title="Fichaje" session={s}>
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 ring-1 ring-zinc-200">
        <p className="text-sm text-zinc-500">Hoy</p>
        <p className="mt-1 text-2xl font-semibold">{next === "in" ? "Entrada" : "Salida"}</p>
        <div className="mt-6">
          <PunchPad next={next} hasFace={hasFace} />
        </div>
        <ViaticForm
          day={todayYmd}
          already={Boolean(viaticToday)}
          payVia={viaticToday?.pay_via ?? undefined}
          paid={Boolean(viaticToday?.paid_at)}
          status={viaticToday?.status ?? undefined}
        />
        <ul className="mt-6 space-y-2 text-sm">
          {(today ?? []).map((r) => {
            const out = r.punch_type === "out" || String(r.method).endsWith(":out");
            return (
              <li key={r.id} className="text-zinc-600">
                {out ? "Salida" : "Entrada"} · {new Date(r.recorded_at).toLocaleTimeString("es-AR")}
                {r.distance_meters != null ? ` · ${r.distance_meters} m de la sede` : ""}
              </li>
            );
          })}
        </ul>
      </div>
    </Shell>
  );
}
