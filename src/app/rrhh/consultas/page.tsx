import { Shell } from "@/components/shell";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { TICKET_CATEGORY, TICKET_STATUS } from "@/lib/labels";
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
    .select("id, subject, status, category, created_at, employees(first_name, last_name, user_id)")
    .eq("tenant_id", s.tenantId!)
    .order("created_at", { ascending: false });
  const current = tickets?.find((t) => t.id === id) ?? tickets?.[0] ?? null;
  const { data: messages } = current
    ? await db
        .from("hr_ticket_messages")
        .select("id, body, created_at, author_id")
        .eq("ticket_id", current.id)
        .order("created_at")
    : { data: [] };

  type TicketRow = NonNullable<typeof tickets>[number];
  function empOf(t: TicketRow) {
    const raw = t.employees as { first_name: string; last_name: string; user_id: string | null } | { first_name: string; last_name: string; user_id: string | null }[] | null;
    return Array.isArray(raw) ? raw[0] : raw;
  }

  const currentEmp = current ? empOf(current) : null;
  const who = currentEmp ? `${currentEmp.last_name}, ${currentEmp.first_name}` : "Empleado";

  return (
    <Shell area="rrhh" title="Consultas" session={s}>
      <p className="mb-4 text-sm" style={{ color: "var(--muted)" }}>
        Elegí una consulta a la izquierda. El chat de la derecha es solo de esa persona.
      </p>
      <div className="grid gap-4 lg:grid-cols-[minmax(16rem,20rem)_1fr]">
        <ul className="panel divide-y overflow-hidden">
          {(tickets ?? []).map((t) => {
            const emp = empOf(t);
            const active = current?.id === t.id;
            return (
              <li key={t.id}>
                <a
                  href={`/rrhh/consultas?id=${t.id}`}
                  className={`block px-4 py-3 text-sm ${active ? "bg-[color-mix(in_srgb,var(--accent)_12%,white)]" : ""}`}
                >
                  <p className="font-medium">{emp ? `${emp.last_name}, ${emp.first_name}` : "—"}</p>
                  <p className={active ? "font-medium" : "text-zinc-600"}>{t.subject}</p>
                  <p className="text-xs text-zinc-500">
                    {TICKET_CATEGORY[t.category] ?? t.category} · {TICKET_STATUS[t.status] ?? t.status}
                  </p>
                </a>
              </li>
            );
          })}
          {!tickets?.length ? <li className="px-4 py-6 text-sm text-zinc-500">No hay consultas.</li> : null}
        </ul>
        {current ? (
          <div className="panel flex min-w-0 flex-col p-5">
            <div className="mb-4 border-b pb-3" style={{ borderColor: "var(--line)" }}>
              <p className="text-xs tracking-widest uppercase" style={{ color: "var(--muted)" }}>
                Conversación con
              </p>
              <p className="text-lg font-semibold">{who}</p>
              <p className="text-sm text-zinc-600">
                {current.subject} · {TICKET_CATEGORY[current.category] ?? current.category} ·{" "}
                {TICKET_STATUS[current.status] ?? current.status}
              </p>
            </div>
            <div className="space-y-3">
              {(messages ?? []).map((m) => {
                const mine = m.author_id === currentEmp?.user_id;
                return (
                  <div
                    key={m.id}
                    className={`max-w-[90%] rounded-xl p-3 text-sm ${mine ? "bg-zinc-100" : "ml-auto bg-[#e8f0ff]"}`}
                  >
                    <p className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                      {mine ? who : "RRHH"}
                    </p>
                    <p className="mt-1">{m.body}</p>
                    <p className="mt-1 text-xs text-zinc-400">{new Date(m.created_at).toLocaleString("es-AR")}</p>
                  </div>
                );
              })}
            </div>
            <form action={addTicketMessage} className="mt-4 flex gap-2">
              <input type="hidden" name="ticket_id" value={current.id} />
              <input name="body" required placeholder={`Responder a ${who}`} className="field flex-1" />
              <button className="btn btn-primary shrink-0">Responder</button>
            </form>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No hay consultas.</p>
        )}
      </div>
    </Shell>
  );
}
