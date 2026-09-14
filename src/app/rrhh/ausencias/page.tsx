import { Shell } from "@/components/shell";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { TIME_OFF_KIND, TIME_OFF_STATUS } from "@/lib/time-off";
import { decideTimeOff, staffTimeOff, scanUnjustifiedAbsences } from "@/modules/time-off/actions";

export default async function AusenciasRrhh() {
  const s = await requireStaff();
  const db = createAdminClient();
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  const [{ data: rows }, { data: people }] = await Promise.all([
    db
      .from("time_off")
      .select("id, kind, starts_on, ends_on, status, note, employee_id, employees(first_name, last_name)")
      .eq("tenant_id", s.tenantId!)
      .order("starts_on", { ascending: false })
      .limit(80),
    db
      .from("employees")
      .select("id, first_name, last_name")
      .eq("tenant_id", s.tenantId!)
      .eq("status", "active")
      .order("last_name"),
  ]);

  return (
    <Shell area="rrhh" title="Ausencias" session={s}>
      <p className="mb-4 max-w-3xl text-sm" style={{ color: "var(--muted)" }}>
        El empleado pide vacaciones y vos autorizás. Día no laboral de la empresa: no cuenta como falta. Si
        alguien no fichó un hábil y no hay justificación, el software marca falta injustificada y la descuenta
        en la liquidación (1/30 del básico).
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <form action={staffTimeOff} className="panel grid gap-2 p-5">
          <p className="text-sm font-medium">Cargar día / licencia</p>
          <select name="kind" className="field">
            <option value="company_off">Día no laboral (toda la empresa)</option>
            <option value="vacation">Vacaciones (autorizadas)</option>
            <option value="leave">Licencia</option>
            <option value="sick">Enfermedad</option>
          </select>
          <select name="employee_id" className="field">
            <option value="">Empresa (solo para día no laboral)</option>
            {(people ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.last_name}, {p.first_name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input name="starts_on" type="date" required className="field" />
            <input name="ends_on" type="date" className="field" />
          </div>
          <input name="note" placeholder="Motivo" className="field" />
          <button className="btn btn-primary">Guardar</button>
        </form>
        <form action={scanUnjustifiedAbsences} className="panel grid gap-2 p-5">
          <p className="text-sm font-medium">Detectar faltas del mes</p>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Días hábiles sin fichaje, sin vacaciones/licencia y sin día no laboral.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input name="period_year" type="number" defaultValue={year} className="field" />
            <input name="period_month" type="number" defaultValue={month} className="field" />
          </div>
          <button className="btn btn-primary">Marcar faltas injustificadas</button>
        </form>
      </div>
      <ul className="panel mt-6 divide-y">
        {(rows ?? []).map((r) => {
          const emp = r.employees as { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
          const e = Array.isArray(emp) ? emp[0] : emp;
          const who = e ? `${e.last_name}, ${e.first_name}` : "Toda la empresa";
          return (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span>
                {who} · {TIME_OFF_KIND[r.kind] ?? r.kind} · {r.starts_on}
                {r.ends_on !== r.starts_on ? ` → ${r.ends_on}` : ""} · {TIME_OFF_STATUS[r.status] ?? r.status}
                {r.note ? ` · ${r.note}` : ""}
              </span>
              {r.status === "pending" ? (
                <div className="flex gap-2">
                  <form action={decideTimeOff}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="status" value="approved" />
                    <button className="btn btn-primary text-xs">Autorizar</button>
                  </form>
                  <form action={decideTimeOff}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="status" value="rejected" />
                    <button className="btn btn-ghost text-xs">Rechazar</button>
                  </form>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}
