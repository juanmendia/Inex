import { Shell } from "@/components/shell";
import { requireEmployee } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyEmployee } from "@/lib/files";
import { ReceiptPaperButton, type ReceiptChip } from "@/components/receipt-paper";

export default async function RecibosEmpleado() {
  const s = await requireEmployee();
  const me = await getMyEmployee(s);
  const db = createAdminClient();
  const { data: receipts } = await db
    .from("receipts")
    .select("id, period_year, period_month, kind, status")
    .eq("employee_id", me?.id ?? "00000000-0000-0000-0000-000000000000")
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false });

  return (
    <Shell area="empleado" title="Mis recibos" session={s}>
      {!receipts?.length ? (
        <p className="text-sm text-zinc-500">Todavía no tenés recibos disponibles.</p>
      ) : (
        <ul className="panel divide-y">
          {(receipts as ReceiptChip[]).map((r) => (
            <li key={r.id} className="px-3 py-2">
              <ReceiptPaperButton r={r} canSign />
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
