import { Shell } from "@/components/shell";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ActividadRrhh() {
  const s = await requireStaff();
  const db = createAdminClient();
  const { data: logs } = await db
    .from("audit_logs")
    .select("id, action, entity_type, created_at, user_id")
    .eq("tenant_id", s.tenantId!)
    .order("created_at", { ascending: false })
    .limit(80);

  return (
    <Shell area="rrhh" title="Actividad" session={s}>
      <ul className="divide-y rounded-xl bg-white ring-1 ring-zinc-200">
        {(logs ?? []).map((l) => (
          <li key={l.id} className="px-4 py-3 text-sm">
            <span className="font-medium">{l.action}</span> · {l.entity_type}
            <span className="block text-xs text-zinc-500">{new Date(l.created_at).toLocaleString("es-AR")}</span>
          </li>
        ))}
        {!logs?.length ? <li className="px-4 py-3 text-sm text-zinc-500">Todavía no hay actividad registrada.</li> : null}
      </ul>
    </Shell>
  );
}
