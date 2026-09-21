import { isArHoliday, buenosAiresDate, buenosAiresMinutes } from "@/lib/ar-holidays";
import { isPunchOut } from "@/lib/attendance";
import { coversDay, datesInRange, isWeekday } from "@/lib/time-off";

/** ponytail: 5 min de holgura; si piden tolerancia por sucursal, leerla de work_locations. */
export const LATE_GRACE_MIN = 5;

export function pct(part: number, of: number) {
  if (of <= 0) return 0;
  return Math.round((part / of) * 1000) / 10;
}

function hmMin(v: string | null | undefined, fallback: number) {
  const t = String(v ?? "").slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(t)) return fallback;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export type Hours = { day_start?: string | null };

export type PunchLite = { employee_id: string; recorded_at: string; punch_type?: string | null; method?: string | null };
export type OffLite = { employee_id: string | null; kind: string; starts_on: string; ends_on: string };
export type ViaticLite = { employee_id: string; day: string };

export type AttendanceScore = {
  id: string;
  name: string;
  expected: number;
  present: number;
  absences: number;
  lates: number;
  viatics: number;
  justified: number;
  pctAbsence: number;
  pctLate: number;
  pctViatic: number;
};

export function workdaysUntil(start: string, end: string, today: string) {
  return datesInRange(start, end).filter((d) => d < today && isWeekday(d) && !isArHoliday(d));
}

export function scorePeople(opts: {
  people: { id: string; name: string; locationStart?: string | null; agreementStart?: string | null }[];
  days: string[];
  punches: PunchLite[];
  offs: OffLite[];
  viatics: ViaticLite[];
}): AttendanceScore[] {
  const punchDays = new Map<string, string[]>();
  const firstIn = new Map<string, number>();
  for (const p of opts.punches) {
    if (isPunchOut(p)) continue;
    const day = buenosAiresDate(p.recorded_at);
    const key = `${p.employee_id}|${day}`;
    const list = punchDays.get(p.employee_id) ?? [];
    if (!list.includes(day)) list.push(day);
    punchDays.set(p.employee_id, list);
    const min = buenosAiresMinutes(p.recorded_at);
    const prev = firstIn.get(key);
    if (prev === undefined || min < prev) firstIn.set(key, min);
  }

  return opts.people.map((emp) => {
    const startMin = hmMin(emp.locationStart, hmMin(emp.agreementStart, 8 * 60));
    const punched = new Set(punchDays.get(emp.id) ?? []);
    const viaticSet = new Set(
      opts.viatics.filter((v) => v.employee_id === emp.id).map((v) => String(v.day).slice(0, 10)),
    );
    let absences = 0;
    let justified = 0;
    let present = 0;
    let lates = 0;
    let viaticCount = 0;
    for (const day of opts.days) {
      if (viaticSet.has(day)) {
        viaticCount += 1;
        continue;
      }
      const leave = opts.offs.some((o) => {
        if (!coversDay(o, day)) return false;
        if (o.kind === "company_off" && !o.employee_id) return true;
        if (o.employee_id !== emp.id) return false;
        return o.kind !== "unjustified";
      });
      if (leave) {
        justified += 1;
        continue;
      }
      if (punched.has(day)) {
        present += 1;
        const inn = firstIn.get(`${emp.id}|${day}`);
        if (inn !== undefined && inn > startMin + LATE_GRACE_MIN) lates += 1;
      } else {
        absences += 1;
      }
    }
    const expected = opts.days.length - justified - viaticCount;
    return {
      id: emp.id,
      name: emp.name,
      expected,
      present,
      absences,
      lates,
      viatics: viaticCount,
      justified,
      pctAbsence: pct(absences, expected),
      pctLate: pct(lates, present),
      pctViatic: pct(viaticCount, opts.days.length),
    };
  });
}

export function scoreGroup(rows: AttendanceScore[]): AttendanceScore {
  const expected = rows.reduce((a, r) => a + r.expected, 0);
  const present = rows.reduce((a, r) => a + r.present, 0);
  const absences = rows.reduce((a, r) => a + r.absences, 0);
  const lates = rows.reduce((a, r) => a + r.lates, 0);
  const viatics = rows.reduce((a, r) => a + r.viatics, 0);
  const justified = rows.reduce((a, r) => a + r.justified, 0);
  const days = expected + justified + viatics;
  return {
    id: "grupo",
    name: "Selección",
    expected,
    present,
    absences,
    lates,
    viatics,
    justified,
    pctAbsence: pct(absences, expected),
    pctLate: pct(lates, present),
    pctViatic: pct(viatics, days),
  };
}
