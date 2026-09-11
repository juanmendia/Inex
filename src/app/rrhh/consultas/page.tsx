import { Shell } from "@/components/shell";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { TICKET_STATUS } from "@/lib/labels";
import { addTicketMessage } from "@/modules/tickets/actions";

export default async function ConsultasRrhh({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const s = await requireStaff();
  const { id } = await searchParams;
  const db = createAdminClient();
  const { data: tickets } = await db
    .from("hr_tickets")
    .select("id, subject, status, category, employees(first_name, last_name)")
    .eq("tenant_id", s.tenantId!)
    .order("created_at", { ascending: false });
  const current = tickets?.find((t) => t.id === id) ?? tickets?.[0];
  const { data: messages } = current
    ? await db.from("hr_ticket_messages").select("id, body, created_at").eq("ticket_id", current.id).order("created_at")
    : { data: [] };

  return (
    <Shell area="rrhh" title="Consultas" session={s}>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <ul className="divide-y rounded-xl bg-white ring-1 ring-zinc-200">
          {(tickets ?? []).map((t) => {
            const empRaw = t.employees as { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
            const emp = Array.isArray(empRaw) ? empRaw[0] : empRaw;
            return (
              <li key={t.id} className="px-4 py-3 text-sm">
                <a href={`/rrhh/consultas?id=${t.id}`}>
                  <p className="font-medium">{t.subject}</p>
                  <p className="text-zinc-500">
                    {emp ? `${emp.last_name}, ${emp.first_name}` : ""} · {TICKET_STATUS[t.status] ?? t.status}
                  </p>
                </a>
              </li>
            );
          })}
        </ul>
        {current ? (
          <div className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
            {(messages ?? []).map((m) => (
              <p key={m.id} className="mb-2 rounded-lg bg-zinc-50 p-3 text-sm">
                {m.body}
              </p>
            ))}
            <form action={addTicketMessage} className="mt-4 flex gap-2">
              <input type="hidden" name="ticket_id" value={current.id} />
              <input name="body" required className="flex-1 rounded-lg border px-3 py-2 text-sm" />
              <button className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">Responder</button>
            </form>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No hay consultas.</p>
        )}
      </div>
    </Shell>
  );
}
