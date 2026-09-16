import { Shell } from "@/components/shell";
import { requireEmployee } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyEmployee } from "@/lib/files";
import { addTicketMessage, createTicket } from "@/modules/tickets/actions";
import { TICKET_STATUS } from "@/lib/labels";

export default async function ConsultasEmpleado({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const s = await requireEmployee();
  const me = await getMyEmployee(s);
  const { id } = await searchParams;
  const db = createAdminClient();
  const { data: tickets } = await db
    .from("hr_tickets")
    .select("id, subject, status, category, created_at")
    .eq("employee_id", me?.id ?? "00000000-0000-0000-0000-000000000000")
    .order("created_at", { ascending: false });
  const current = tickets?.find((t) => t.id === id) ?? tickets?.[0];
  const { data: messages } = current
    ? await db
        .from("hr_ticket_messages")
        .select("id, body, created_at, author_id")
        .eq("ticket_id", current.id)
        .order("created_at")
    : { data: [] };

  return (
    <Shell area="empleado" title="Consultas a RRHH" session={s}>
      <form action={createTicket} className="mb-6 grid gap-2 rounded-xl bg-white p-4 ring-1 ring-zinc-200 sm:grid-cols-2">
        <select name="category" className="rounded-lg border px-3 py-2 text-sm">
          <option value="receipt">Recibo</option>
          <option value="salary">Sueldo</option>
          <option value="vacation">Vacaciones</option>
          <option value="leave">Licencia</option>
          <option value="documents">Documentación</option>
          <option value="other">Otro</option>
        </select>
        <input name="subject" required placeholder="Asunto" className="rounded-lg border px-3 py-2 text-sm" />
        <textarea name="body" required placeholder="Mensaje" className="sm:col-span-2 rounded-lg border px-3 py-2 text-sm" />
        <button className="rounded-lg bg-[#142236] px-4 py-2 text-sm text-white sm:col-span-2">Nueva consulta</button>
      </form>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <ul className="divide-y rounded-xl bg-white ring-1 ring-zinc-200">
          {(tickets ?? []).map((t) => (
            <li key={t.id} className="px-4 py-3 text-sm">
              <a href={`/empleado/consultas?id=${t.id}`}>
                <p className="font-medium">{t.subject}</p>
                <p className="opacity-70">{TICKET_STATUS[t.status] ?? t.status}</p>
              </a>
            </li>
          ))}
        </ul>
        {current ? (
          <div className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
            <div className="space-y-3">
              {(messages ?? []).map((m) => (
                <p key={m.id} className="rounded-lg bg-zinc-50 p-3 text-sm">
                  {m.body}
                  <span className="mt-1 block text-xs text-zinc-400">
                    {new Date(m.created_at).toLocaleString("es-AR")}
                  </span>
                </p>
              ))}
            </div>
            <form action={addTicketMessage} className="mt-4 flex gap-2">
              <input type="hidden" name="ticket_id" value={current.id} />
              <input name="body" required className="flex-1 rounded-lg border px-3 py-2 text-sm" />
              <button className="rounded-lg bg-[#142236] px-3 py-2 text-sm text-white">Enviar</button>
            </form>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No tenés consultas todavía.</p>
        )}
      </div>
    </Shell>
  );
}
