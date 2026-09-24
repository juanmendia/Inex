import { Shell } from "@/components/shell";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const KIND: Record<string, string> = {
  employee: "Personas",
  time_off: "Licencias",
  attendance: "Fichajes",
  viatic: "Viáticos",
  announcement: "Comunicaciones",
  receipt: "Recibos",
  document: "Documentos",
  payroll_run: "Liquidación",
  log: "Otros",
};

const FALLBACK: Record<string, string> = {
  "create employee": "Alta de empleado",
  "update employee": "Cambió una ficha",
  "publish announcement": "Publicó una comunicación",
  "create receipt": "Cargó un recibo",
  "sign receipt": "Se firmó un recibo",
};

function line(action: string, entity: string, metadata: unknown) {
  const meta = metadata && typeof metadata === "object" ? (metadata as { text?: string }) : null;
  if (meta?.text) return meta.text;
  return FALLBACK[`${action} ${entity}`] ?? `${action} · ${entity}`;
}

function baDay(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
}

function baClock(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ActividadRrhh({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; kind?: string; q?: string }>;
}) {
  const s = await requireStaff();
  const sp = await searchParams;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  const from = (sp.from ?? "").slice(0, 10) || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const to = (sp.to ?? "").slice(0, 10) || today;
  const kind = (sp.kind ?? "").trim();
  const q = (sp.q ?? "").trim().toLowerCase();

  const db = createAdminClient();
  let query = db
    .from("audit_logs")
    .select("id, action, entity_type, created_at, user_id, metadata")
    .eq("tenant_id", s.tenantId!)
    .gte("created_at", `${from}T00:00:00-03:00`)
    .lte("created_at", `${to}T23:59:59-03:00`)
    .order("created_at", { ascending: false })
    .limit(300);
  if (kind) query = query.eq("entity_type", kind);
  const { data: logs } = await query;

  const userIds = [...new Set((logs ?? []).map((l) => l.user_id).filter(Boolean))];
  const { data: people } = userIds.length
    ? await db.from("profiles").select("id, full_name, email").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null; email: string }[] };
  const who = new Map((people ?? []).map((p) => [p.id, p.full_name || p.email]));

  const rows = (logs ?? [])
    .map((l) => ({
      ...l,
      text: line(l.action, l.entity_type, l.metadata),
      who: who.get(l.user_id) ?? "RRHH",
      tipo: KIND[l.entity_type] ?? l.entity_type,
    }))
    .filter((r) => {
      if (!q) return true;
      return `${r.text} ${r.who} ${r.tipo}`.toLowerCase().includes(q);
    });

  return (
    <Shell area="rrhh" title="Actividad" session={s}>
      <p className="mb-4 max-w-2xl text-sm" style={{ color: "var(--muted)" }}>
        Log de lo que se carga a mano: altas, bajas, licencias, fichajes de RRHH y autorizaciones.
      </p>
      <form method="get" className="panel mb-4 flex flex-wrap items-end gap-2 p-4">
        <label className="text-xs">
          Desde
          <input name="from" type="date" defaultValue={from} className="field mt-1" />
        </label>
        <label className="text-xs">
          Hasta
          <input name="to" type="date" defaultValue={to} className="field mt-1" />
        </label>
        <label className="text-xs">
          Tipo
          <select name="kind" defaultValue={kind} className="field mt-1">
            <option value="">Todos</option>
            {Object.entries(KIND).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[12rem] flex-1 text-xs">
          Buscar
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Nombre, alta, licencia…" className="field mt-1" />
        </label>
        <button className="btn btn-primary">Filtrar</button>
      </form>

      <div className="panel overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-medium">Fecha</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Qué</th>
              <th className="px-3 py-2 font-medium">Quién</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                <td className="whitespace-nowrap px-3 py-2 text-xs" style={{ color: "var(--muted)" }}>
                  {baDay(r.created_at)} {baClock(r.created_at)}
                </td>
                <td className="px-3 py-2 text-xs">{r.tipo}</td>
                <td className="px-3 py-2">{r.text}</td>
                <td className="px-3 py-2 text-xs">{r.who}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-sm" style={{ color: "var(--muted)" }}>
                  No hay movimientos en ese filtro.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
        {rows.length} movimiento{rows.length === 1 ? "" : "s"}
      </p>
    </Shell>
  );
}
