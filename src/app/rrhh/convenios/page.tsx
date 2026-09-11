import { Shell } from "@/components/shell";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveAgreement } from "@/modules/agreements/actions";

export default async function ConveniosPage() {
  const s = await requireStaff();
  const db = createAdminClient();
  const { data: rows } = await db
    .from("collective_agreements")
    .select("id, name, monthly_hours, notes")
    .eq("tenant_id", s.tenantId!)
    .order("name");

  return (
    <Shell area="rrhh" title="Convenios" session={s}>
      <p className="mb-4 max-w-2xl text-sm" style={{ color: "var(--muted)" }}>
        Armá los convenios de esta empresa y después asignalos en la ficha de cada persona. Las horas
        mensuales del convenio se usan para el valor hora si están cargadas.
      </p>
      <form action={saveAgreement} className="panel mb-6 grid gap-2 p-5 md:grid-cols-3">
        <input name="name" required placeholder="Nombre (ej. Comercio, UOCRA)" className="field" />
        <input name="monthly_hours" type="number" placeholder="Horas mensuales (opcional)" className="field" />
        <input name="notes" placeholder="Notas / categoría tipo" className="field" />
        <button className="btn btn-primary md:col-span-3">Guardar convenio</button>
      </form>
      <ul className="panel divide-y">
        {(rows ?? []).map((r) => (
          <li key={r.id} className="px-4 py-3 text-sm">
            <span className="font-medium">{r.name}</span>
            {r.monthly_hours ? <span className="text-zinc-500"> · {r.monthly_hours} h/mes</span> : null}
            {r.notes ? <p className="text-xs text-zinc-500">{r.notes}</p> : null}
          </li>
        ))}
      </ul>
    </Shell>
  );
}
