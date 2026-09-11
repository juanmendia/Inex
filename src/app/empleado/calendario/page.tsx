import { Shell } from "@/components/shell";
import { requireEmployee } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function CalendarioEmpleado() {
  const s = await requireEmployee();
  const db = createAdminClient();
  const { data: events } = await db
    .from("events")
    .select("id, title, type, starts_at, location")
    .eq("tenant_id", s.tenantId!)
    .order("starts_at");
  const { data: people } = await db
    .from("employees")
    .select("first_name, last_name, birth_date, hire_date")
    .eq("tenant_id", s.tenantId!)
    .eq("status", "active");

  return (
    <Shell area="empleado" title="Calendario" session={s}>
      <h2 className="text-sm font-medium text-zinc-500">Eventos</h2>
      <ul className="mt-2 divide-y rounded-xl bg-white ring-1 ring-zinc-200">
        {(events ?? []).map((e) => (
          <li key={e.id} className="px-4 py-3 text-sm">
            <span className="font-medium">{e.title}</span>{" "}
            <span className="text-zinc-500">
              {new Date(e.starts_at).toLocaleString("es-AR")} · {e.type}
            </span>
          </li>
        ))}
        {!events?.length ? <li className="px-4 py-3 text-sm text-zinc-500">No hay eventos.</li> : null}
      </ul>
      <h2 className="mt-6 text-sm font-medium text-zinc-500">Cumpleaños (sin año)</h2>
      <ul className="mt-2 divide-y rounded-xl bg-white ring-1 ring-zinc-200">
        {(people ?? [])
          .filter((p) => p.birth_date)
          .map((p) => (
            <li key={p.first_name + p.last_name} className="px-4 py-3 text-sm">
              {p.first_name} {p.last_name} ·{" "}
              {new Date(p.birth_date + "T00:00:00").toLocaleDateString("es-AR", {
                day: "numeric",
                month: "long",
              })}
            </li>
          ))}
      </ul>
    </Shell>
  );
}
