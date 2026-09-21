"use client";

import { useMemo, useState } from "react";
import type { AttendanceScore } from "@/lib/attendance-report";

function Bar({ value, color }: { value: number; color: string }) {
  const w = Math.min(100, Math.max(0, value));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
      <div className="h-full rounded-full" style={{ width: `${w}%`, background: color }} />
    </div>
  );
}

export function AttendanceReportView({
  year,
  month,
  people,
  selected,
  rows,
  group,
}: {
  year: number;
  month: number;
  people: { id: string; name: string }[];
  selected: string[];
  rows: AttendanceScore[];
  group: AttendanceScore;
}) {
  const [q, setQ] = useState("");
  const [ids, setIds] = useState<string[]>(selected);
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? people.filter((p) => p.name.toLowerCase().includes(n)) : people;
  }, [people, q]);

  function toggle(id: string) {
    setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Asistencia por persona</h2>
      <p className="mb-4 max-w-2xl text-sm" style={{ color: "var(--muted)" }}>
        Elegí uno o varios. Falta = día hábil sin fichaje ni licencia ni viático. Tarde = primera entrada más de 5
        min después del horario. Viático = días autorizados.
      </p>
      <form method="get" className="panel space-y-4 p-5">
        <div className="flex flex-wrap gap-3">
          <label className="text-xs">
            Año
            <input name="year" type="number" defaultValue={year} className="field mt-1 w-24" />
          </label>
          <label className="text-xs">
            Mes
            <input name="month" type="number" min={1} max={12} defaultValue={month} className="field mt-1 w-20" />
          </label>
          <input type="hidden" name="ids" value={ids.join(",")} />
          <button className="btn btn-primary self-end">Ver</button>
          <button type="button" className="btn btn-ghost self-end text-xs" onClick={() => setIds(people.map((p) => p.id))}>
            Todos
          </button>
          <button type="button" className="btn btn-ghost self-end text-xs" onClick={() => setIds([])}>
            Ninguno
          </button>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="field max-w-sm" />
        <ul className="grid max-h-56 gap-1 overflow-auto text-sm sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-zinc-50">
                <input type="checkbox" checked={ids.includes(p.id)} onChange={() => toggle(p.id)} />
                {p.name}
              </label>
            </li>
          ))}
        </ul>
      </form>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
          Marcá al menos un empleado y pulsá Ver.
        </p>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ["Faltas", `${group.pctAbsence}%`, `${group.absences} días`],
              ["Llegadas tarde", `${group.pctLate}%`, `${group.lates} de ${group.present} entradas`],
              ["Viáticos", `${group.pctViatic}%`, `${group.viatics} días`],
            ].map(([l, n, s]) => (
              <div key={l} className="panel p-4">
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  {l} · grupo
                </p>
                <p className="text-2xl font-semibold">{n}</p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {s}
                </p>
              </div>
            ))}
          </div>

          <div className="panel mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Empleado</th>
                  <th className="px-3 py-2">% falta</th>
                  <th className="px-3 py-2">% tarde</th>
                  <th className="px-3 py-2">% viático</th>
                  <th className="px-3 py-2">Días</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t align-top">
                    <td className="px-3 py-3 font-medium">{r.name}</td>
                    <td className="px-3 py-3">
                      <p className="mb-1">{r.pctAbsence}%</p>
                      <Bar value={r.pctAbsence} color="#b45309" />
                    </td>
                    <td className="px-3 py-3">
                      <p className="mb-1">{r.pctLate}%</p>
                      <Bar value={r.pctLate} color="#1d4ed8" />
                    </td>
                    <td className="px-3 py-3">
                      <p className="mb-1">{r.pctViatic}%</p>
                      <Bar value={r.pctViatic} color="#0f766e" />
                    </td>
                    <td className="px-3 py-3 text-xs" style={{ color: "var(--muted)" }}>
                      {r.absences} faltas · {r.lates} tardes · {r.viatics} viáticos
                      <br />
                      {r.present} presentes · {r.justified} con licencia
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
