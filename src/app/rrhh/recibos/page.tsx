import { Shell } from "@/components/shell";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishReceipt } from "@/modules/receipts/actions";
import { GenerateReceiptsForm } from "./generate-form";
import { ReceiptPaperButton, type ReceiptChip } from "@/components/receipt-paper";

export default async function RecibosRrhh() {
  const s = await requireStaff();
  const db = createAdminClient();
  const [{ data: employees }, { data: receipts }] = await Promise.all([
    db
      .from("employees")
      .select("id, first_name, last_name, employee_number")
      .eq("tenant_id", s.tenantId!)
      .eq("status", "active")
      .order("last_name"),
    db
      .from("receipts")
      .select("id, period_year, period_month, kind, status, employee_id")
      .eq("tenant_id", s.tenantId!)
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false }),
  ]);
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;

  return (
    <Shell area="rrhh" title="Recibos" session={s}>
      <GenerateReceiptsForm employees={employees ?? []} year={year} month={month} />
      <details className="mb-6">
        <summary className="cursor-pointer text-sm" style={{ color: "var(--muted)" }}>
          Subir un PDF de otro sistema (opcional)
        </summary>
        <form action={publishReceipt} className="panel mt-2 grid gap-2 p-5 md:grid-cols-5">
          <select name="employee_id" required className="field">
            <option value="">Empleado</option>
            {(employees ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.employee_number} · {e.last_name}, {e.first_name}
              </option>
            ))}
          </select>
          <input name="period_year" type="number" defaultValue={year} className="field" />
          <input name="period_month" type="number" min={1} max={12} defaultValue={month} className="field" />
          <input name="kind" defaultValue="haberes" className="field" />
          <input name="file" type="file" accept="application/pdf" multiple required className="text-sm md:col-span-4" />
          <button className="btn btn-primary">Publicar PDF</button>
        </form>
      </details>
      <ul className="panel divide-y">
        {(employees ?? []).map((e) => {
          const mine = (receipts ?? []).filter((r) => r.employee_id === e.id) as ReceiptChip[];
          return (
            <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-48 flex-1">
                <p className="text-sm font-medium">
                  {e.last_name}, {e.first_name}
                </p>
                <p className="text-xs opacity-60">Legajo {e.employee_number}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {mine.length ? mine.map((r) => <ReceiptPaperButton key={r.id} r={r} hr />) : (
                  <span className="text-xs opacity-50">Sin recibos</span>
                )}
              </div>
            </li>
          );
        })}
        {!employees?.length ? <li className="px-4 py-3 text-sm opacity-60">No hay empleados activos.</li> : null}
      </ul>
    </Shell>
  );
}
