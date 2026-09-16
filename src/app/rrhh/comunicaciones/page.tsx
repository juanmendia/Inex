import { Shell } from "@/components/shell";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishAnnouncement } from "@/modules/announcements/actions";

export default async function ComunicacionesRrhh() {
  const s = await requireStaff();
  const db = createAdminClient();
  const { data: items } = await db
    .from("announcements")
    .select("id, title, body, published_at")
    .eq("tenant_id", s.tenantId!)
    .order("created_at", { ascending: false });

  return (
    <Shell area="rrhh" title="Comunicaciones" session={s}>
      <form action={publishAnnouncement} className="mb-6 space-y-2 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
        <input name="title" required placeholder="Título" className="w-full rounded-lg border px-3 py-2 text-sm" />
        <textarea name="body" required placeholder="Contenido" className="w-full rounded-lg border px-3 py-2 text-sm" rows={5} />
        <button className="rounded-lg bg-[#142236] px-4 py-2 text-sm text-white">Publicar</button>
      </form>
      <ul className="space-y-3">
        {(items ?? []).map((a) => (
          <li key={a.id} className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
            <p className="font-medium">{a.title}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">{a.body}</p>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
