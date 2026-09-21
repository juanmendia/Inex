"use client";

import { useMemo, useState } from "react";
import { Check, Trash2, X } from "lucide-react";
import { deleteAttendancePunch } from "@/modules/attendance/actions";
import { ConfirmForm } from "@/components/confirm-dialog";

export type AttendancePunch = {
  id: string;
  employeeId: string;
  name: string;
  search: string;
  at: string;
  out: boolean;
  branch: string | null;
  photo: string | null;
  meters: number | null;
  missingOut?: boolean;
  scheduledOut?: boolean;
};

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

function clock(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtHours(ms: number) {
  if (ms <= 0) return "0 h";
  const h = Math.floor(ms / 3600000);
  const m = Math.round((ms % 3600000) / 60000);
  return `${h} h ${String(m).padStart(2, "0")} min`;
}

function hoursDecimal(ms: number) {
  return Math.round((ms / 3600000) * 100) / 100;
}

function PunchTime({ punch, empty }: { punch: AttendancePunch | null; empty: string }) {
  if (!punch) return <div>{empty}</div>;
  if (punch.missingOut) return <div className="text-red-800">No fichó</div>;
  return (
    <div className="flex items-center gap-1.5">
      <span>
        {clock(punch.at)}
        {punch.scheduledOut ? <span className="ml-1 text-[11px] text-amber-800">horario</span> : null}
      </span>
      <ConfirmForm action={deleteAttendancePunch} title="¿Borrar este fichaje?" body="Se quita de asistencia. Podés cargarlo de nuevo a mano.">
        <input type="hidden" name="id" value={punch.id} />
        <button type="submit" className="rounded p-0.5 text-red-700 opacity-50 hover:opacity-100" title="Borrar fichaje">
          <Trash2 size={14} />
        </button>
      </ConfirmForm>
    </div>
  );
}

export function AttendanceBoard({
  punches,
  employees,
  year,
  month,
  viatics = [],
}: {
  punches: AttendancePunch[];
  employees: { id: string; first_name: string; last_name: string; employee_number?: string }[];
  year: number;
  month: number;
  viatics?: { employeeId: string; date: string; name: string }[];
}) {
  const [q, setQ] = useState("");
  const [empId, setEmpId] = useState("");
  const [sort, setSort] = useState<"name" | "time">("name");

  const days = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const viaticSet = new Set(viatics.map((v) => `${v.employeeId}|${v.date}`));
    const filtered = punches.filter((p) => {
      if (empId && p.employeeId !== empId) return false;
      if (needle && !p.search.toLowerCase().includes(needle) && !p.name.toLowerCase().includes(needle)) return false;
      return true;
    });
    const byDay = new Map<string, AttendancePunch[]>();
    for (const p of filtered) {
      const k = dayKey(p.at);
      const list = byDay.get(k) ?? [];
      list.push(p);
      byDay.set(k, list);
    }
    for (const v of viatics) {
      if (empId && v.employeeId !== empId) continue;
      if (needle && !v.name.toLowerCase().includes(needle)) continue;
      if (!byDay.has(v.date)) byDay.set(v.date, []);
    }
    return [...byDay.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, list]) => {
        const byEmp = new Map<string, AttendancePunch[]>();
        for (const p of list) {
          const arr = byEmp.get(p.employeeId) ?? [];
          arr.push(p);
          byEmp.set(p.employeeId, arr);
        }
        const people = [...byEmp.entries()].map(([id, ps]) => {
          const sorted = [...ps].sort((a, b) => a.at.localeCompare(b.at));
          const legs: { inn: AttendancePunch | null; out: AttendancePunch | null }[] = [];
          let open: AttendancePunch | null = null;
          for (const p of sorted) {
            if (!p.out) {
              if (open) legs.push({ inn: open, out: null });
              open = p;
            } else if (open) {
              legs.push({ inn: open, out: p });
              open = null;
            } else {
              legs.push({ inn: null, out: p });
            }
          }
          if (open) legs.push({ inn: open, out: null });
          const isViatic = viaticSet.has(`${id}|${date}`);
          const ms = isViatic
            ? 0
            : legs.reduce((acc, l) => {
                if (!l.inn || !l.out) return acc;
                const d = new Date(l.out.at).getTime() - new Date(l.inn.at).getTime();
                return acc + Math.max(0, d);
              }, 0);
          const missing = !isViatic && legs.some((l) => l.out?.missingOut || (!l.out && l.inn));
          const ok = isViatic || (legs.length > 0 && legs.every((l) => l.inn && l.out) && !missing);
          const firstIn = legs.find((l) => l.inn)?.inn ?? null;
          const lastOut = [...legs].reverse().find((l) => l.out)?.out ?? null;
          return {
            id,
            name: sorted[0]!.name,
            legs,
            firstIn,
            lastOut,
            ok,
            viatic: isViatic,
            ms,
            hours: isViatic ? "Viático" : ms > 0 ? fmtHours(ms) : "—",
            photo: firstIn?.photo ?? lastOut?.photo ?? null,
            branch: firstIn?.branch ?? lastOut?.branch ?? null,
            meters: firstIn?.meters ?? lastOut?.meters ?? null,
            first: sorted[0]!.at,
            punchIds: sorted.map((x) => x.id).join(","),
          };
        });
        for (const v of viatics) {
          if (v.date !== date) continue;
          if (empId && v.employeeId !== empId) continue;
          if (needle && !v.name.toLowerCase().includes(needle)) continue;
          if (people.some((p) => p.id === v.employeeId)) continue;
          people.push({
            id: v.employeeId,
            name: v.name,
            legs: [],
            firstIn: null,
            lastOut: null,
            ok: true,
            viatic: true,
            ms: 0,
            hours: "Viático",
            photo: null,
            branch: null,
            meters: null,
            first: `${date}T12:00:00-03:00`,
            punchIds: "",
          });
        }
        people.sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name, "es") : a.first.localeCompare(b.first)));
        const dayMs = people.reduce((acc, p) => acc + p.ms, 0);
        return { date, people, dayMs };
      });
  }, [punches, q, empId, sort, viatics]);

  const peopleOpts = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return employees;
    return employees.filter((e) => `${e.employee_number ?? ""} ${e.last_name} ${e.first_name}`.toLowerCase().includes(needle));
  }, [employees, q]);

  const totals = useMemo(() => {
    let ms = 0;
    let ok = 0;
    let bad = 0;
    for (const d of days) {
      for (const p of d.people) {
        if (p.ok) {
          ok++;
          ms += p.ms;
        } else bad++;
      }
    }
    return { ms, ok, bad };
  }, [days]);

  return (
    <div className="mt-4 space-y-4">
      <form method="get" className="panel grid gap-2 p-4 md:grid-cols-6">
        <p className="text-sm font-medium md:col-span-6">Mes para el recibo (horas de entrada a salida)</p>
        <input name="year" type="number" defaultValue={year} className="field" />
        <input name="month" type="number" min={1} max={12} defaultValue={month} className="field" />
        <button className="btn btn-primary">Ver mes</button>
        <input
          className="field md:col-span-2"
          placeholder="Buscar por apellido, nombre o legajo…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="field" value={empId} onChange={(e) => setEmpId(e.target.value)}>
          <option value="">Todos los empleados</option>
          {peopleOpts.map((e) => (
            <option key={e.id} value={e.id}>
              {e.employee_number ? `${e.employee_number} · ` : ""}
              {e.last_name}, {e.first_name}
            </option>
          ))}
        </select>
        <select className="field" value={sort} onChange={(e) => setSort(e.target.value as "name" | "time")}>
          <option value="name">Orden: apellido</option>
          <option value="time">Orden: hora</option>
        </select>
      </form>

      {empId ? (
        <div className="panel grid gap-3 p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase" style={{ color: "var(--muted)" }}>
              Horas del mes
            </p>
            <p className="text-xl font-semibold">{fmtHours(totals.ms)}</p>
            <p className="text-xs opacity-60">{hoursDecimal(totals.ms)} hs (recibo / extras)</p>
          </div>
          <div>
            <p className="text-xs uppercase" style={{ color: "var(--muted)" }}>
              Días completos
            </p>
            <p className="text-xl font-semibold">{totals.ok}</p>
          </div>
          <div>
            <p className="text-xs uppercase" style={{ color: "var(--muted)" }}>
              Días incompletos
            </p>
            <p className="text-xl font-semibold">{totals.bad}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          El total de horas es por persona: elegí un empleado arriba.
        </p>
      )}

      {days.map((d) => (
        <section key={d.date} className="panel overflow-hidden">
          <h2 className="border-b px-4 py-3 text-sm font-medium" style={{ borderColor: "var(--line)" }}>
            {new Date(d.date + "T12:00:00").toLocaleDateString("es-AR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
            <span className="ml-2 font-normal opacity-60">
              {d.people.length} persona{d.people.length === 1 ? "" : "s"}
              {empId && d.dayMs ? ` · ${fmtHours(d.dayMs)}` : ""}
            </span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-xs uppercase" style={{ color: "var(--muted)" }}>
                <tr>
                  <th className="px-4 py-2 font-medium">Empleado</th>
                  <th className="px-4 py-2 font-medium">Entradas</th>
                  <th className="px-4 py-2 font-medium">Salidas</th>
                  <th className="px-4 py-2 font-medium">Hs. del día</th>
                  <th className="px-4 py-2 font-medium">Sucursal</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {d.people.map((p) => (
                  <tr key={p.id} className={p.viatic ? "bg-sky-50/80" : p.ok ? "bg-emerald-50/80" : "bg-red-50/80"}>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        {p.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.photo} alt="" className="h-9 w-9 rounded-lg object-cover" />
                        ) : null}
                        {p.name}
                      </div>
                    </td>
                    <td className="px-4 py-2 tabular-nums">
                      {p.legs.map((l, i) => (
                        <PunchTime key={`${p.id}-in-${i}`} punch={l.inn} empty="—" />
                      ))}
                    </td>
                    <td className="px-4 py-2 tabular-nums">
                      {p.legs.map((l, i) => (
                        <PunchTime
                          key={`${p.id}-out-${i}`}
                          punch={l.out}
                          empty={l.inn ? "Sin salida" : "—"}
                        />
                      ))}
                    </td>
                    <td className="px-4 py-2 tabular-nums opacity-70">{p.hours}</td>
                    <td className="px-4 py-2 opacity-70">
                      {p.branch ?? "—"}
                      {p.meters != null ? ` · ${p.meters} m` : ""}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        {p.viatic ? (
                          <span className="text-xs font-medium text-sky-800">Viático</span>
                        ) : p.ok ? (
                          <Check className="text-emerald-700" size={18} aria-label="Completo" />
                        ) : (
                          <X className="text-red-700" size={18} aria-label="Incompleto" />
                        )}
                        {!p.ok ? (
                          <ConfirmForm
                            action={deleteAttendancePunch}
                            title="¿Limpiar el día de esta persona?"
                            body="Se borran todos los fichajes de ese día. Después podés cargarlos de nuevo a mano."
                            confirm="Limpiar"
                          >
                            <input type="hidden" name="ids" value={p.punchIds} />
                            <button type="submit" className="text-xs text-red-700 underline">
                              Limpiar
                            </button>
                          </ConfirmForm>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {!days.length ? <p className="px-1 text-sm opacity-60">No hay fichajes con ese filtro.</p> : null}
    </div>
  );
}
