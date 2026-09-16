import Link from "next/link";
import { Shell } from "@/components/shell";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function RrhhHome() {
  const s = await requireStaff();
  const db = createAdminClient();
  const tid = s.tenantId!;
  const [emps, pending, signed, non, tickets, tenant] = await Promise.all([
    db.from("employees").select("id", { count: "exact", head: true }).eq("tenant_id", tid),
    db.from("receipts").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("status", "pending"),
    db.from("receipts").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("status", "signed"),
    db
      .from("receipts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .eq("status", "non_conforming"),
    db.from("hr_tickets").select("id", { count: "exact", head: true }).eq("tenant_id", tid).neq("status", "closed"),
    db.from("tenants").select("name").eq("id", tid).single(),
  ]);

  const cards = [
    ["Empleados", emps.count ?? 0, "/rrhh/empleados"],
    ["Pendientes de firma", pending.count ?? 0, "/rrhh/recibos"],
    ["Firmados", signed.count ?? 0, "/rrhh/recibos"],
    ["No conformes", non.count ?? 0, "/rrhh/recibos"],
    ["Consultas abiertas", tickets.count ?? 0, "/rrhh/consultas"],
  ] as const;

  return (
    <Shell area="rrhh" title={`RRHH · ${tenant.data?.name ?? ""}`} session={s}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map(([label, n, href]) => (
          <Link key={label} href={href} className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{n}</p>
          </Link>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link className="btn btn-primary" href="/rrhh/empleados">
          + Empleado
        </Link>
        <Link className="btn btn-primary" href="/rrhh/recibos">
          + Cargar recibo
        </Link>
        <Link className="rounded-lg border px-4 py-2 text-sm" href="/rrhh/eventos">
          + Evento
        </Link>
      </div>
    </Shell>
  );
}
