import { Shell } from "@/components/shell";
import { requireEmployee } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ComunicacionesEmpleado() {
  const s = await requireEmployee();
  const db = createAdminClient();
  const { data: items } = await db
    .from("announcements")
    .select("id, title, body, published_at")
    .eq("tenant_id", s.tenantId!)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false });

  return (
    <Shell area="empleado" title="Comunicaciones" session={s}>
      {(items ?? []).length === 0 ? (
        <p className="text-sm text-zinc-500">No hay comunicaciones todavía.</p>
      ) : (
        <ul className="space-y-3">
          {items!.map((a) => (
            <li key={a.id} className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
              <p className="font-medium">{a.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">{a.body}</p>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
