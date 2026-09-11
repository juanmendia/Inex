import { Shell } from "@/components/shell";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { addNovelty, runPayroll, setBaseSalary } from "@/modules/payroll/actions";
import { hourValue, PAYROLL_NOVELTY, PAYROLL_RUN } from "@/lib/labels";

export default async function LiquidacionPage() {
  const s = await requireStaff();
  const db = createAdminClient();
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  const [{ data: employees }, { data: runs }, { data: novelties }, { data: settings }] = await Promise.all([
    db
      .from("employees")
      .select("id, first_name, last_name, employee_number, base_salary")
      .eq("tenant_id", s.tenantId!)
      .eq("status", "active"),
    db
      .from("payroll_runs")
      .select("id, period_year, period_month, status, created_at")
      .eq("tenant_id", s.tenantId!)
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("payroll_novelties")
      .select("id, concept, amount, status, period_month, period_year, note, hours, rate_percent")
      .eq("tenant_id", s.tenantId!)
      .order("created_at", { ascending: false })
      .limit(30),
    db.from("tenant_settings").select("monthly_hours").eq("tenant_id", s.tenantId!).maybeSingle(),
  ]);
  const monthly = Number(settings?.monthly_hours ?? 176);

  return (
    <Shell area="rrhh" title="Liquidación" session={s}>
      <p className="mb-6 max-w-2xl text-sm" style={{ color: "var(--muted)" }}>
        El valor hora se calcula solo: sueldo básico ÷ horas mensuales ({monthly} h, configurable). En extras solo
        cargás las <strong>horas</strong> y el recargo (100 %, 150 % o 200 % según día y horario).
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <form action={setBaseSalary} className="panel space-y-3 p-5">
          <p className="text-xs tracking-widest uppercase" style={{ color: "var(--muted)" }}>
            Sueldo básico
          </p>
          <select name="employee_id" className="field">
            {(employees ?? []).map((e) => {
              const vh = hourValue(Number(e.base_salary ?? 0), monthly);
              return (
                <option key={e.id} value={e.id}>
                  {e.employee_number} · {e.last_name} · básico {e.base_salary ?? 0} · hora {vh}
                </option>
              );
            })}
          </select>
          <input name="base_salary" type="number" step="0.01" placeholder="Importe mensual" className="field" />
          <button className="btn btn-primary">Guardar básico</button>
        </form>

        <form action={addNovelty} className="panel space-y-3 p-5">
          <p className="text-xs tracking-widest uppercase" style={{ color: "var(--muted)" }}>
            Horas extras (cálculo automático)
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
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-xs tracking-widest uppercase" style={{ color: "var(--muted)" }}>
        Liquidaciones
      </h2>
      <ul className="panel mt-2 divide-y">
        {(runs ?? []).map((r) => (
          <li key={r.id} className="px-4 py-3 text-sm">
            {r.period_month}/{r.period_year} · {PAYROLL_RUN[r.status] ?? r.status}
          </li>
        ))}
      </ul>
    </Shell>
  );
}
