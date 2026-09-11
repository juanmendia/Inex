import Link from "next/link";
import { Shell } from "@/components/shell";
import { DocFrame } from "@/components/doc-frame";
import { requireEmployee } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyEmployee } from "@/lib/files";

export default async function DocumentosEmpleado({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const s = await requireEmployee();
  const me = await getMyEmployee(s);
  const { id } = await searchParams;
  const db = createAdminClient();
  const { data: docs } = await db
    .from("documents")
    .select("id, title, type, status, employee_id")
    .eq("tenant_id", s.tenantId!)
    .neq("type", "receipt")
    .or(`employee_id.is.null,employee_id.eq.${me?.id ?? "00000000-0000-0000-0000-000000000000"}`)
    .order("created_at", { ascending: false });
  const selected = docs?.find((d) => d.id === id) ?? docs?.[0];

  return (
    <Shell area="empleado" title="Mis documentos" session={s}>
      {!docs?.length ? (
        <p className="text-sm text-zinc-500">Todavía no tenés documentos disponibles.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <ul className="divide-y rounded-xl bg-white ring-1 ring-zinc-200">
            {docs.map((d) => (
              <li key={d.id}>
                <Link href={`/empleado/documentos?id=${d.id}`} className="block px-4 py-3 text-sm">
                  {d.title}
                </Link>
              </li>
            ))}
          </ul>
          {selected ? <DocFrame documentId={selected.id} /> : null}
        </div>
      )}
    </Shell>
  );
}
