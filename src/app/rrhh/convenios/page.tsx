import { Shell } from "@/components/shell";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { TYPICAL_AGREEMENTS } from "@/lib/agreements-catalog";
import {
  saveAgreement,
  addAgreement,
  addTypicalAgreement,
  deleteAgreement,
  applyAgreementRaise,
} from "@/modules/agreements/actions";

export default async function ConveniosPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const s = await requireStaff();
  const { edit } = await searchParams;
  const db = createAdminClient();
  const full = await db
    .from("collective_agreements")
    .select("id, name, monthly_hours, notes, created_at, scale_amount, day_start, day_end, afternoon_start, afternoon_end, rate_weekday, rate_saturday, rate_sunday, rate_holiday, rate_night")
    .eq("tenant_id", s.tenantId!)
    .order("created_at", { ascending: false });
  const { data: rows } = full.error
    ? await db
        .from("collective_agreements")
        .select("id, name, monthly_hours, notes, created_at")
        .eq("tenant_id", s.tenantId!)
        .order("created_at", { ascending: false })
    : full;

  const have = new Set((rows ?? []).map((r) => r.name));
  const extra = TYPICAL_AGREEMENTS.filter((a) => !have.has(a.name));
  const editing = (rows ?? []).find((r) => r.id === edit);

  return (
    <Shell area="rrhh" title="Convenios" session={s}>
      <p className="mb-4 max-w-2xl text-sm" style={{ color: "var(--muted)" }}>
        Cada convenio tiene su básico y su aumento. Comercio 3,2% no toca a Bancarios. El % solo actualiza a
        quienes tienen asignado ese convenio. Extra de cada persona: ficha → Laboral.
      </p>
      <form action={addAgreement} className="mb-4">
        <button className="btn btn-primary">Agregar</button>
      </form>

      {editing ? (
        <form action={saveAgreement} className="panel mb-4 space-y-2 p-4">
          <p className="text-sm font-medium">Editando</p>
          <input type="hidden" name="id" value={editing.id} />
          <input name="name" required defaultValue={editing.name} className="field" placeholder="Nombre" />
          <div className="flex flex-wrap gap-2">
            <input
              name="monthly_hours"
              type="number"
              defaultValue={editing.monthly_hours ?? ""}
              placeholder="Horas/mes"
              className="field max-w-[8rem]"
            />
            <input
              name="scale_amount"
              type="number"
              step="0.01"
              defaultValue={(editing as { scale_amount?: number }).scale_amount ?? ""}
              placeholder="Básico del convenio"
              className="field max-w-[12rem]"
            />
            <input name="notes" defaultValue={editing.notes ?? ""} placeholder="Notas" className="field min-w-0 flex-1" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium">Mañana</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  Entrada
                  <input
                    name="day_start"
                    type="time"
                    defaultValue={String((editing as { day_start?: string }).day_start ?? "09:00").slice(0, 5)}
                    className="field mt-1"
                  />
                </label>
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  Salida
                  <input
                    name="day_end"
                    type="time"
                    defaultValue={String((editing as { day_end?: string }).day_end ?? "13:00").slice(0, 5)}
                    className="field mt-1"
                  />
                </label>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium">Tarde</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  Entrada
                  <input
                    name="afternoon_start"
                    type="time"
                    defaultValue={String((editing as { afternoon_start?: string }).afternoon_start ?? "14:00").slice(0, 5) || "14:00"}
                    className="field mt-1"
                  />
                </label>
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  Salida
                  <input
                    name="afternoon_end"
                    type="time"
                    defaultValue={String((editing as { afternoon_end?: string }).afternoon_end ?? "18:00").slice(0, 5)}
                    className="field mt-1"
                  />
                </label>
              </div>
            </div>
          </div>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Si es corrido, poné mañana de inicio a fin y dejá la tarde vacía (borrá las horas).
          </p>
          <p className="pt-2 text-xs font-medium">% de hora extra (este convenio)</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <label className="text-xs" style={{ color: "var(--muted)" }}>
              Lun–vie
              <input
                name="rate_weekday"
                type="number"
                defaultValue={(editing as { rate_weekday?: number }).rate_weekday ?? 150}
                className="field mt-1"
              />
            </label>
            <label className="text-xs" style={{ color: "var(--muted)" }}>
              Sábado
              <input
                name="rate_saturday"
                type="number"
                defaultValue={(editing as { rate_saturday?: number }).rate_saturday ?? 200}
                className="field mt-1"
              />
            </label>
            <label className="text-xs" style={{ color: "var(--muted)" }}>
              Domingo
              <input
                name="rate_sunday"
                type="number"
                defaultValue={(editing as { rate_sunday?: number }).rate_sunday ?? 200}
                className="field mt-1"
              />
            </label>
            <label className="text-xs" style={{ color: "var(--muted)" }}>
              Feriado
              <input
                name="rate_holiday"
                type="number"
                defaultValue={(editing as { rate_holiday?: number }).rate_holiday ?? 200}
                className="field mt-1"
              />
            </label>
            <label className="text-xs" style={{ color: "var(--muted)" }}>
              Noche 21–6
              <input
                name="rate_night"
                type="number"
                defaultValue={(editing as { rate_night?: number }).rate_night ?? 200}
                className="field mt-1"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary">Guardar</button>
            <button formAction={deleteAgreement} className="btn btn-ghost text-red-800" type="submit">
              Quitar
            </button>
            <a href="/rrhh/convenios" className="btn btn-ghost">
              Cerrar
            </a>
          </div>
        </form>
      ) : null}
      {editing ? (
        <form action={applyAgreementRaise} className="panel mb-4 grid gap-2 p-4 md:grid-cols-4">
          <p className="text-sm font-medium md:col-span-4">
            Aumento solo de {editing.name} (no se aplica a los otros convenios)
          </p>
          <input type="hidden" name="id" value={editing.id} />
          <input name="percent" type="number" step="0.01" placeholder="% de este convenio (ej. 3.2)" className="field" />
          <input name="new_amount" type="number" step="0.01" placeholder="O nuevo básico de este" className="field" />
          <input name="effective_on" type="date" className="field" />
          <input name="note" placeholder="Paritaria / nota" className="field" />
          <button className="btn btn-primary md:col-span-4">Aplicar a {editing.name}</button>
        </form>
      ) : null}

      <ul className="panel divide-y overflow-hidden">
        {(rows ?? []).map((r) => (
          <li key={r.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 truncate">
              <span className="font-medium">{r.name}</span>
              {r.monthly_hours ? <span className="text-zinc-500"> · {r.monthly_hours} h</span> : null}
              {(r as { scale_amount?: number }).scale_amount ? (
                <span className="text-zinc-500"> · ${(r as { scale_amount?: number }).scale_amount}</span>
              ) : (
                <span className="text-zinc-500"> · sin básico</span>
              )}
            </p>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <form action={applyAgreementRaise} className="flex items-center gap-1">
                <input type="hidden" name="id" value={r.id} />
                <input
                  name="percent"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="% aum."
                  className="field w-24"
                  aria-label={`Porcentaje de aumento de ${r.name}`}
                />
                <button className="btn btn-primary whitespace-nowrap">Aplicar %</button>
              </form>
              <a href={`/rrhh/convenios?edit=${r.id}`} className="text-sm" style={{ color: "var(--accent)" }}>
                Editar
              </a>
            </div>
          </li>
        ))}
        {!rows?.length ? (
          <li className="px-4 py-6 text-sm" style={{ color: "var(--muted)" }}>
            Todavía no hay. Pulsá Agregar.
          </li>
        ) : null}
      </ul>
      {extra.length ? (
        <div className="mt-8">
          <p className="mb-2 text-sm font-medium">Típicos que todavía no usás</p>
          <ul className="panel divide-y overflow-hidden">
            {extra.map((a) => (
              <li key={a.name} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="min-w-0 truncate">{a.name}</span>
                <form action={addTypicalAgreement} className="shrink-0">
                  <input type="hidden" name="name" value={a.name} />
                  <button className="btn btn-ghost text-sm">Agregar</button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Shell>
  );
}
