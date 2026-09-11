import Link from "next/link";
import { Shell } from "@/components/shell";
import { PdfFrame } from "@/components/pdf-frame";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishReceipt } from "@/modules/receipts/actions";
import { RECEIPT_STATUS } from "@/lib/labels";

export default async function RecibosRrhh({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const s = await requireStaff();
  const { id } = await searchParams;
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
      .select("id, period_year, period_month, kind, status, employee_id, employees(first_name, last_name)")
      .eq("tenant_id", s.tenantId!)
      .order("published_at", { ascending: false }),
  ]);
  const selected = receipts?.find((r) => r.id === id) ?? receipts?.[0];
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;

  return (
    <Shell area="rrhh" title="Recibos" session={s}>
      <form action={publishReceipt} className="panel mb-6 grid gap-2 p-5 md:grid-cols-5">
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
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <ul className="divide-y rounded-xl bg-white ring-1 ring-zinc-200">
          {(receipts ?? []).map((r) => {
            const empRaw = r.employees as { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
            const emp = Array.isArray(empRaw) ? empRaw[0] : empRaw;
            return (
              <li key={r.id}>
                <Link href={`/rrhh/recibos?id=${r.id}`} className="block px-4 py-3 text-sm">
                  <p className="font-medium">
                    {emp ? `${emp.last_name}, ${emp.first_name}` : "—"} · {r.period_month}/{r.period_year}
                  </p>
                  <p className="opacity-70">{RECEIPT_STATUS[r.status] ?? r.status}</p>
                </Link>
              </li>
            );
          })}
          {!receipts?.length ? <li className="px-4 py-3 text-sm text-zinc-500">No hay recibos publicados.</li> : null}
        </ul>
        {selected ? <PdfFrame receiptId={selected.id} hr /> : null}
      </div>
    </Shell>
  );
}
