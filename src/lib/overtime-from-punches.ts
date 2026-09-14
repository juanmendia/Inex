import { isArHoliday, buenosAiresDate, buenosAiresMinutes } from "@/lib/ar-holidays";

export type Punch = { recorded_at: string; punch_type: string | null; method: string | null };

function isOut(p: Punch) {
  return p.punch_type === "out" || String(p.method ?? "").endsWith(":out");
}

function parseHm(v: string | null | undefined, fallback: number) {
  if (!v) return fallback;
  const [h, m] = String(v).slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(h)) return fallback;
  return h * 60 + (m || 0);
}

function addHours(map: Map<number, number>, rate: number, hours: number) {
  if (hours <= 0) return;
  map.set(rate, Math.round(((map.get(rate) ?? 0) + hours) * 4) / 4);
}

/** Extras según jornada y % del convenio (sábado fuera de horario, domingo, feriado, noche). */
export function overtimeFromPunches(
  punches: Punch[],
  opts: {
    dayStart?: string | null;
    dayEnd?: string | null;
    afternoonStart?: string | null;
    afternoonEnd?: string | null;
    rateWeekday?: number | null;
    rateSaturday?: number | null;
    rateSunday?: number | null;
    rateHoliday?: number | null;
    rateNight?: number | null;
  },
) {
  const weekday = opts.rateWeekday || 150;
  const saturday = opts.rateSaturday || 200;
  const sunday = opts.rateSunday || 200;
  const holiday = opts.rateHoliday || 200;
  const night = opts.rateNight || 200;
  const start = parseHm(opts.dayStart, 9 * 60);
  const end = parseHm(opts.dayEnd, 13 * 60);
  let journey = Math.max(30, end - start);
  if (opts.afternoonStart && opts.afternoonEnd) {
    journey += Math.max(30, parseHm(opts.afternoonEnd, 18 * 60) - parseHm(opts.afternoonStart, 14 * 60));
  } else if (!opts.afternoonStart && opts.dayEnd) {
    journey = Math.max(60, parseHm(opts.dayEnd, 18 * 60) - start);
  }
  const byDay = new Map<string, Punch[]>();
  for (const p of punches) {
    const day = buenosAiresDate(p.recorded_at);
    const list = byDay.get(day) ?? [];
    list.push(p);
    byDay.set(day, list);
  }
  const byRate = new Map<number, number>();
  for (const [day, list] of byDay) {
    const ordered = [...list].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
    let inAt: Punch | null = null;
    let worked = 0;
    let nightMin = 0;
    for (const p of ordered) {
      if (!isOut(p)) inAt = p;
      else if (inAt) {
        const a = new Date(inAt.recorded_at).getTime();
        const b = new Date(p.recorded_at).getTime();
        if (b > a) {
          worked += (b - a) / 60000;
          nightMin += nightOverlap(buenosAiresMinutes(inAt.recorded_at), buenosAiresMinutes(p.recorded_at));
        }
        inAt = null;
      }
    }
    if (worked <= 1) continue;
    const dow = new Date(`${day}T12:00:00-03:00`).getDay();
    if (isArHoliday(day)) {
      addHours(byRate, holiday, worked / 60);
      continue;
    }
    if (dow === 0) {
      addHours(byRate, sunday, worked / 60);
      continue;
    }
    const extra = Math.max(0, worked - journey);
    if (extra <= 1) continue;
    const extraH = extra / 60;
    const nightH = Math.min(extraH, nightMin / 60);
    addHours(byRate, night, nightH);
    const rest = extraH - nightH;
    addHours(byRate, dow === 6 ? saturday : weekday, rest);
  }
  return [...byRate.entries()].filter(([, h]) => h > 0).map(([rate, hours]) => ({ rate, hours }));
}

function nightOverlap(from: number, to: number) {
  const nightStart = 21 * 60;
  const nightEnd = 24 * 60;
  const morning = 6 * 60;
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  return (
    Math.max(0, Math.min(hi, nightEnd) - Math.max(lo, nightStart)) +
    Math.max(0, Math.min(hi, morning) - Math.max(lo, 0))
  );
}
