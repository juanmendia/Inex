import { Shell } from "@/components/shell";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createEvent } from "@/modules/events/actions";

export default async function EventosPage() {
  const s = await requireStaff();
  const db = createAdminClient();
  const { data: events } = await db
    .from("events")
    .select("id, title, type, starts_at, location")
    .eq("tenant_id", s.tenantId!)
    .order("starts_at", { ascending: false });

  return (
    <Shell area="rrhh" title="Eventos" session={s}>
      <form action={createEvent} className="mb-6 grid gap-2 rounded-xl bg-white p-4 ring-1 ring-zinc-200 md:grid-cols-2">
        <input name="title" required placeholder="Título" className="rounded-lg border px-3 py-2 text-sm" />
        <input name="starts_at" type="datetime-local" required className="rounded-lg border px-3 py-2 text-sm" />
        <select name="type" className="rounded-lg border px-3 py-2 text-sm">
          <option value="internal">Interno</option>
          <option value="training">Capacitación</option>
          <option value="meeting">Reunión</option>
          <option value="holiday">Feriado</option>
        </select>
        <input name="location" placeholder="Lugar" className="rounded-lg border px-3 py-2 text-sm" />
        <textarea name="description" placeholder="Descripción" className="rounded-lg border px-3 py-2 text-sm md:col-span-2" />
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white md:col-span-2">Crear evento</button>
      </form>
      <ul className="divide-y rounded-xl bg-white ring-1 ring-zinc-200">
        {(events ?? []).map((e) => (
          <li key={e.id} className="px-4 py-3 text-sm">
            {e.title} · {new Date(e.starts_at).toLocaleString("es-AR")} · {e.type}
          </li>
        ))}
      </ul>
    </Shell>
  );
}
