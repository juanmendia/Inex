import { Shell } from "@/components/shell";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { addNovelty, runPayroll, loadOvertimeFromAttendance, updateNovelty } from "@/modules/payroll/actions";
import { PAYROLL_NOVELTY, PAYROLL_RUN } from "@/lib/labels";

export default async function LiquidacionPage() {
  const s = await requireStaff();
  const db = createAdminClient();
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  const [{ data: employees }, { data: runs }, { data: novelties }] = await Promise.all([
    db
      .from("employees")
      .select("id, first_name, last_name, employee_number, base_salary")
      .eq("tenant_id", s.tenantId!)
      .eq("status", "active"),
    db
      .from("payroll_runs")
      .select("id, period_year, period_month, status, kind, created_at")
      .eq("tenant_id", s.tenantId!)
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("payroll_novelties")
      .select("id, concept, amount, status, period_month, period_year, note, hours, rate_percent")
      .eq("tenant_id", s.tenantId!)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  return (
    <Shell area="rrhh" title="Liquidación" session={s}>
      <p className="mb-6 max-w-2xl text-sm" style={{ color: "var(--muted)" }}>
        El básico sale del convenio (más un adicional en la ficha). Acá: extras automáticas desde fichajes, un
        plus suelto si hace falta, y cerrar el mes. Si alguien se va: ficha → Baja.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <form action={loadOvertimeFromAttendance} className="panel space-y-3 p-5">
          <p className="text-xs tracking-widest uppercase" style={{ color: "var(--muted)" }}>
            Horas extras desde fichaje
          </p>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Compara entrada/salida con el horario del convenio. Hábil 150%, domingo/feriado/noche 200%. Se puede
            corregir abajo.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input name="period_year" type="number" defaultValue={year} className="field" />
            <input name="period_month" type="number" defaultValue={month} className="field" />
          </div>
          <button className="btn btn-primary">Armar extras del mes</button>
        </form>

        <form action={addNovelty} className="panel space-y-3 p-5">
          <p className="text-xs tracking-widest uppercase" style={{ color: "var(--muted)" }}>
            Extra a mano (si querés corregir)
          </p>
          <input type="hidden" name="kind" value="extra" />
          <select name="employee_id" className="field">
            {(employees ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.last_name}, {e.first_name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input name="period_year" type="number" defaultValue={year} className="field" />
            <input name="period_month" type="number" defaultValue={month} className="field" />
          </div>
          <select name="rate_percent" className="field">
            <option value="150">150 % — hábil o sábado (extra 50 %)</option>
            <option value="200">200 % — domingo, feriado o nocturna</option>
            <option value="100">100 % — hora simple</option>
          </select>
          <input name="hours" type="number" step="0.5" min="0.5" placeholder="Cantidad de horas" className="field" required />
          <button className="btn btn-primary">Calcular y cargar</button>
        </form>
      </div>

      <form action={addNovelty} className="panel mt-4 grid gap-2 p-5 md:grid-cols-5">
        <p className="text-xs tracking-widest uppercase md:col-span-5" style={{ color: "var(--muted)" }}>
          Otro concepto (importe manual)
        </p>
        <input type="hidden" name="kind" value="other" />
        <select name="employee_id" className="field">
          {(employees ?? []).map((e) => (
            <option key={e.id} value={e.id}>
              {e.last_name}
            </option>
          ))}
        </select>
        <input name="period_year" type="number" defaultValue={year} className="field" />
        <input name="period_month" type="number" defaultValue={month} className="field" />
        <input name="concept" placeholder="Premio, viático…" className="field" />
        <input name="amount" type="number" step="0.01" placeholder="Importe" className="field" />
        <button className="btn btn-primary md:col-span-5">Cargar concepto</button>
      </form>

      <form action={runPayroll} className="mt-4 flex flex-wrap items-end gap-2">
        <input name="period_year" type="number" defaultValue={year} className="field max-w-28" />
        <input name="period_month" type="number" defaultValue={month} className="field max-w-20" />
        <button className="btn btn-primary">Cerrar liquidación del período</button>
        <p className="w-full text-xs" style={{ color: "var(--muted)" }}>
          Al cerrar también se generan los PDF de recibos (si todavía no existen).
        </p>
      </form>

      <h2 className="mt-8 text-xs tracking-widest uppercase" style={{ color: "var(--muted)" }}>
        Novedades
      </h2>
      <ul className="panel mt-2 divide-y" style={{ borderColor: "var(--line)" }}>
        {(novelties ?? []).map((n) => (
          <li key={n.id} className="px-4 py-3 text-sm">
            <span className="font-medium">{n.concept}</span>
            <span className="opacity-70">
              {" "}
              · {n.hours ? `${n.hours} h · ` : ""}
              {n.amount} · {n.period_month}/{n.period_year} · {PAYROLL_NOVELTY[n.status] ?? n.status}
            </span>
            {n.note ? <p className="text-xs opacity-60">{n.note}</p> : null}
            {n.status !== "liquidated" && n.hours != null ? (
              <form action={updateNovelty} className="mt-2 flex flex-wrap gap-2">
                <input type="hidden" name="id" value={n.id} />
                <input name="hours" type="number" step="0.25" defaultValue={n.hours ?? ""} className="field max-w-24" />
                <select name="rate_percent" defaultValue={n.rate_percent ?? 150} className="field max-w-28">
                  <option value="150">150%</option>
                  <option value="200">200%</option>
                  <option value="100">100%</option>
                </select>
                <button className="btn btn-ghost text-xs">Recalcular</button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-xs tracking-widest uppercase" style={{ color: "var(--muted)" }}>
        Liquidaciones
      </h2>
      <ul className="panel mt-2 divide-y">
        {(runs ?? []).map((r) => (
          <li key={r.id} className="px-4 py-3 text-sm">
            {r.period_month}/{r.period_year}
            {r.kind === "final" ? " · final" : ""} · {PAYROLL_RUN[r.status] ?? r.status}
          </li>
        ))}
      </ul>
    </Shell>
  );
}
