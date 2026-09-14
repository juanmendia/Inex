import { Shell } from "@/components/shell";
import { requireEmployee } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyEmployee } from "@/lib/files";
import { TIME_OFF_KIND, TIME_OFF_STATUS } from "@/lib/time-off";
import { requestTimeOff, updateMyTimeOff, cancelMyTimeOff } from "@/modules/time-off/actions";

export default async function VacacionesEmpleado() {
  const s = await requireEmployee();
  const me = await getMyEmployee(s);
  const db = createAdminClient();
  const { data: rows } = me
    ? await db.from("time_off").select("*").eq("employee_id", me.id).order("starts_on", { ascending: false })
    : { data: [] };

  return (
    <Shell area="empleado" title="Vacaciones y licencias" session={s}>
      <p className="mb-4 max-w-2xl text-sm" style={{ color: "var(--muted)" }}>
        Pedí las fechas. RRHH autoriza. Mientras esté pendiente podés cambiarla o borrarla. Si ya está
        autorizada, cancelala y RRHH se entera.
      </p>
      <form action={requestTimeOff} className="panel mb-6 grid gap-2 p-5 md:grid-cols-4">
        <select name="kind" className="field">
          <option value="vacation">Vacaciones</option>
          <option value="leave">Licencia</option>
          <option value="sick">Enfermedad</option>
        </select>
        <input name="starts_on" type="date" required className="field" />
        <input name="ends_on" type="date" required className="field" />
        <input name="note" placeholder="Nota" className="field" />
        <button className="btn btn-primary md:col-span-4">Pedir</button>
      </form>
      <ul className="panel divide-y">
        {(rows ?? []).map((r) => (
          <li key={r.id} className="space-y-2 px-4 py-3 text-sm">
            <p>
              {TIME_OFF_KIND[r.kind] ?? r.kind} · {r.starts_on} → {r.ends_on} · {TIME_OFF_STATUS[r.status] ?? r.status}
            </p>
            {r.status === "pending" ? (
              <form action={updateMyTimeOff} className="flex flex-wrap gap-2">
                <input type="hidden" name="id" value={r.id} />
                <select name="kind" defaultValue={r.kind} className="field max-w-40">
                  <option value="vacation">Vacaciones</option>
                  <option value="leave">Licencia</option>
                  <option value="sick">Enfermedad</option>
                </select>
                <input name="starts_on" type="date" defaultValue={r.starts_on} className="field max-w-40" />
                <input name="ends_on" type="date" defaultValue={r.ends_on} className="field max-w-40" />
                <input name="note" defaultValue={r.note ?? ""} className="field max-w-xs" />
                <button className="btn btn-primary">Guardar</button>
              </form>
            ) : null}
            {r.status === "pending" || r.status === "approved" ? (
              <form action={cancelMyTimeOff}>
                <input type="hidden" name="id" value={r.id} />
                <button className="text-sm text-red-800">{r.status === "pending" ? "Eliminar" : "Cancelar"}</button>
              </form>
            ) : null}
          </li>
        ))}
        {!rows?.length ? <li className="px-4 py-6 text-sm text-zinc-500">Todavía no pediste nada.</li> : null}
      </ul>
    </Shell>
  );
}
