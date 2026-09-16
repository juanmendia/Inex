import Link from "next/link";
import { Shell } from "@/components/shell";
import { DocFrame } from "@/components/doc-frame";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishDocument } from "@/modules/documents/actions";

export default async function DocumentosRrhh({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const s = await requireStaff();
  const { id } = await searchParams;
  const db = createAdminClient();
  const [{ data: employees }, { data: docs }] = await Promise.all([
    db.from("employees").select("id, first_name, last_name, employee_number").eq("tenant_id", s.tenantId!).eq("status", "active"),
    db
      .from("documents")
      .select("id, title, type, status, employee_id")
      .eq("tenant_id", s.tenantId!)
      .order("created_at", { ascending: false }),
  ]);
  const selected = docs?.find((d) => d.id === id) ?? docs?.[0];

  return (
    <Shell area="rrhh" title="Documentos" session={s}>
      <form action={publishDocument} className="mb-6 grid gap-2 rounded-xl bg-white p-4 ring-1 ring-zinc-200 md:grid-cols-4">
        <input name="title" required placeholder="Título" className="rounded-lg border px-3 py-2 text-sm" />
        <select name="type" className="rounded-lg border px-3 py-2 text-sm">
          <option value="policy">Política</option>
          <option value="certificate">Certificado</option>
          <option value="contract">Contrato</option>
          <option value="notice">Comunicado</option>
          <option value="other">Otro</option>
        </select>
        <select name="employee_id" className="rounded-lg border px-3 py-2 text-sm">
          <option value="">Toda la empresa</option>
          {(employees ?? []).map((e) => (
            <option key={e.id} value={e.id}>
              {e.employee_number} · {e.last_name}
            </option>
          ))}
        </select>
        <input name="file" type="file" accept="application/pdf" required className="text-sm" />
        <button className="rounded-lg bg-[#142236] px-4 py-2 text-sm text-white md:col-span-4">Publicar</button>
      </form>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <ul className="divide-y rounded-xl bg-white ring-1 ring-zinc-200">
          {(docs ?? []).map((d) => (
            <li key={d.id}>
              <Link href={`/rrhh/documentos?id=${d.id}`} className="block px-4 py-3 text-sm">
                <p className="font-medium">{d.title}</p>
                <p className="text-zinc-500">{d.type}</p>
              </Link>
            </li>
          ))}
        </ul>
        {selected ? <DocFrame documentId={selected.id} /> : <p className="text-sm text-zinc-500">No hay documentos.</p>}
      </div>
    </Shell>
  );
}
