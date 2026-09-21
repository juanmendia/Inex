import { Shell } from "@/components/shell";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { addNovelty, runPayroll, loadOvertimeFromAttendance, updateNovelty } from "@/modules/payroll/actions";
import { setViaticPaid } from "@/modules/attendance/actions";
import { PAYROLL_NOVELTY, PAYROLL_RUN } from "@/lib/labels";
import { PAYROLL_CONCEPTS } from "@/lib/payroll-concepts";

export default async function LiquidacionPage() {
  const s = await requireStaff();
  const db = createAdminClient();
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  const startDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDay = new Date(year, month, 0).toISOString().slice(0, 10);
  const [{ data: employees }, { data: runs }, { data: novelties }, { data: viatics }] = await Promise.all([
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
    db
      .from("viatic_days")
      .select("id, employee_id, day, pay_via, paid_at, note, status")
      .eq("tenant_id", s.tenantId!)
      .gte("day", startDay)
      .lte("day", endDay)
      .order("day", { ascending: false }),
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
            Compara entrada/salida con el horario del convenio. Hábil 150%, domingo/feriado/noche 200%. Los días de
            viático no entran. Se puede corregir abajo.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input name="period_year" type="number" defaultValue={year} className="field" />
            <input name="period_month" type="number" defaultValue={month} className="field" />
          </div>
          <button className="btn btn-primary">Armar extras del mes</button>
        </form>

        <form action={addNovelty} className="panel space-y-3 p-5">
          <p className="text-xs tracking-widest uppercase" style={{ color: "var(--muted)" }}>
            Otro concepto (código de liquidación)
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
          Otro concepto (código de liquidación)
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
        <select name="concept" className="field">
          {PAYROLL_CONCEPTS.filter((c) => !c.auto).map((c) => (
            <option key={c.code} value={`${c.code} ${c.name}`}>
              {c.code} · {c.name}
            </option>
          ))}
        </select>
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
        Viáticos del mes
      </h2>
      <p className="mt-1 max-w-2xl text-xs" style={{ color: "var(--muted)" }}>
        Tildá “Ya pagado” si se lo entregaste en efectivo o al día siguiente: sale del recibo. Destildá para que vuelva al recibo (si pidió recibo).
      </p>
      <ul className="panel mt-2 divide-y" style={{ borderColor: "var(--line)" }}>
        {(viatics ?? []).length === 0 ? (
          <li className="px-4 py-3 text-sm opacity-60">Nadie cargó viático este mes.</li>
        ) : (
          (viatics ?? []).map((v) => {
            const emp = (employees ?? []).find((e) => e.id === v.employee_id);
            const paid = Boolean(v.paid_at);
            const st = v.status ?? "approved";
            const onSlip = st === "approved" && !paid && v.pay_via !== "cash";
            return (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">
                    {emp ? `${emp.last_name}, ${emp.first_name}` : "Empleado"} · {String(v.day).slice(0, 10)}
                  </p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    {st === "pending"
                      ? "Pendiente en Viáticos"
                      : st === "rejected"
                        ? "No autorizado"
                        : paid
                          ? "Pagado aparte · no va al recibo"
                          : onSlip
                            ? "En el recibo"
                            : "Pago aparte, pendiente de entregar"}
                    {v.note ? ` · ${v.note}` : ""}
                  </p>
                </div>
                {st === "approved" ? (
                <form action={setViaticPaid}>
                  <input type="hidden" name="id" value={v.id} />
                  <input type="hidden" name="paid" value={paid ? "0" : "1"} />
                  <button className="btn btn-ghost text-xs">{paid ? "Destildar" : "Ya pagado"}</button>
                </form>
                ) : null}
              </li>
            );
          })
        )}
      </ul>

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
