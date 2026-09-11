import Link from "next/link";
import { Shell } from "@/components/shell";
import { PdfFrame } from "@/components/pdf-frame";
import { SignButtons } from "@/components/sign-buttons";
import { requireEmployee } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { RECEIPT_STATUS } from "@/lib/labels";
import { getMyEmployee } from "@/lib/files";

export default async function RecibosEmpleado({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const s = await requireEmployee();
  const me = await getMyEmployee(s);
  const { id } = await searchParams;
  const db = createAdminClient();
  const { data: receipts } = await db
    .from("receipts")
    .select("id, period_year, period_month, kind, status")
    .eq("employee_id", me?.id ?? "00000000-0000-0000-0000-000000000000")
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false });

  const selected = receipts?.find((r) => r.id === id) ?? receipts?.[0];

  return (
    <Shell area="empleado" title="Mis recibos" session={s}>
      {!receipts?.length ? (
        <p className="text-sm text-zinc-500">Todavía no tenés recibos disponibles.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <ul className="divide-y rounded-xl bg-white ring-1 ring-zinc-200">
            {receipts.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/empleado/recibos?id=${r.id}`}
                  className={`block px-4 py-3 text-sm ${selected?.id === r.id ? "bg-indigo-50" : ""}`}
                >
                  <p className="font-medium">
                    Recibo {r.kind} {String(r.period_month).padStart(2, "0")}/{r.period_year}
                  </p>
                  <p className="opacity-70">{RECEIPT_STATUS[r.status] ?? r.status}</p>
                </Link>
              </li>
            ))}
          </ul>
          {selected ? (
            <div className="space-y-4">
              <PdfFrame receiptId={selected.id} />
              <SignButtons receiptId={selected.id} pending={selected.status === "pending"} />
              <Link className="text-sm text-indigo-600" href={`/empleado/consultas?recibo=${selected.id}`}>
                Consultar a RRHH
              </Link>
            </div>
          ) : null}
        </div>
      )}
    </Shell>
  );
}
