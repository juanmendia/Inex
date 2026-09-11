import { Shell } from "@/components/shell";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ReportesPage() {
  const s = await requireStaff();
  const db = createAdminClient();
  const tid = s.tenantId!;
  const [pending, signed, non, emps, tickets] = await Promise.all([
    db.from("receipts").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("status", "pending"),
    db.from("receipts").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("status", "signed"),
    db.from("receipts").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("status", "non_conforming"),
    db.from("employees").select("id", { count: "exact", head: true }).eq("tenant_id", tid),
    db.from("hr_tickets").select("id", { count: "exact", head: true }).eq("tenant_id", tid).neq("status", "closed"),
  ]);

  return (
    <Shell area="rrhh" title="Reportes" session={s}>
      <div className="grid gap-4 sm:grid-cols-5">
        {[
          ["Empleados", emps.count ?? 0],
          ["Pendientes", pending.count ?? 0],
          ["Firmados", signed.count ?? 0],
          ["No conformes", non.count ?? 0],
          ["Consultas abiertas", tickets.count ?? 0],
        ].map(([l, n]) => (
          <div key={String(l)} className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
            <p className="text-sm text-zinc-500">{l}</p>
            <p className="text-2xl font-semibold">{n}</p>
          </div>
        ))}
      </div>
      <a
        href="/rrhh/reportes/csv"
        className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white"
      >
        Descargar CSV de recibos
      </a>
    </Shell>
  );
}
