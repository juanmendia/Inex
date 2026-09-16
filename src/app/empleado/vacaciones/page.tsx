import { Shell } from "@/components/shell";
import { requireEmployee } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyEmployee, signedUrl } from "@/lib/files";
import { TIME_OFF_KIND, TIME_OFF_STATUS } from "@/lib/time-off";
import { ensureLeaveTypes, requestTimeOff, updateMyTimeOff, cancelMyTimeOff } from "@/modules/time-off/actions";

export default async function VacacionesEmpleado() {
  const s = await requireEmployee();
  const me = await getMyEmployee(s);
  const types = await ensureLeaveTypes(s.tenantId!);
  const ask = types.filter((t) => t.active && t.employee_can_request);
  const db = createAdminClient();
  const { data: rows } = me
    ? await db.from("time_off").select("*").eq("employee_id", me.id).order("starts_on", { ascending: false })
    : { data: [] };
  const byId = new Map(types.map((t) => [t.id, t]));
  const certs: Record<string, string> = {};
  for (const r of rows ?? []) {
    if (r.certificate_path) certs[r.id] = await signedUrl(r.certificate_path);
  }

  return (
    <Shell area="empleado" title="Vacaciones y licencias" session={s}>
      <p className="mb-4 max-w-2xl text-sm" style={{ color: "var(--muted)" }}>
        Elegí el tipo de licencia. Si pide certificado, adjuntá la foto o el PDF. RRHH autoriza.
      </p>
      <form action={requestTimeOff} className="panel mb-6 grid gap-2 p-5 md:grid-cols-2">
        <select name="leave_type_id" required className="field md:col-span-2">
          <option value="">Tipo de licencia</option>
          {ask.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.requires_certificate ? " (pide certificado)" : ""}
            </option>
          ))}
        </select>
        <input name="starts_on" type="date" required className="field" />
        <input name="ends_on" type="date" required className="field" />
        <input name="note" placeholder="Nota" className="field md:col-span-2" />
        <label className="text-sm md:col-span-2">
          Certificado (foto o PDF), si corresponde
          <input name="certificate" type="file" accept="image/*,application/pdf" className="mt-1 block text-sm" />
        </label>
        <button className="btn btn-primary md:col-span-2">Pedir</button>
      </form>
      <ul className="panel divide-y">
        {(rows ?? []).map((r) => {
          const label = (r.leave_type_id && byId.get(r.leave_type_id)?.name) || TIME_OFF_KIND[r.kind] || r.kind;
          return (
            <li key={r.id} className="space-y-2 px-4 py-3 text-sm">
              <p>
                {label} · {r.starts_on} → {r.ends_on} · {TIME_OFF_STATUS[r.status] ?? r.status}
              </p>
              {certs[r.id] ? (
                <a className="text-[#142236]" href={certs[r.id]} target="_blank" rel="noreferrer">
                  Ver certificado
                </a>
              ) : null}
              {r.status === "pending" ? (
                <form action={updateMyTimeOff} className="flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <select name="leave_type_id" defaultValue={r.leave_type_id ?? ask[0]?.id ?? ""} className="field max-w-xs">
                    {ask.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <input name="starts_on" type="date" defaultValue={r.starts_on} className="field max-w-40" />
                  <input name="ends_on" type="date" defaultValue={r.ends_on} className="field max-w-40" />
                  <input name="note" defaultValue={r.note ?? ""} className="field max-w-xs" />
                  <input name="certificate" type="file" accept="image/*,application/pdf" className="text-sm" />
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
          );
        })}
        {!rows?.length ? <li className="px-4 py-6 text-sm text-zinc-500">Todavía no pediste nada.</li> : null}
      </ul>
    </Shell>
  );
}
