import { isArHoliday, buenosAiresDate, buenosAiresMinutes } from "@/lib/ar-holidays";

export type Punch = {
  recorded_at: string;
  punch_type: string | null;
  method: string | null;
  work_location_id?: string | null;
};

export type JourneyHours = {
  dayStart?: string | null;
  dayEnd?: string | null;
  afternoonStart?: string | null;
  afternoonEnd?: string | null;
};

function journeyMinutes(opts: JourneyHours) {
  const start = parseHm(opts.dayStart, 8 * 60);
  const end = parseHm(opts.dayEnd, 15 * 60);
  if (opts.afternoonStart && opts.afternoonEnd) {
    return (
      Math.max(30, parseHm(opts.dayEnd, 12 * 60 + 30) - start) +
      Math.max(30, parseHm(opts.afternoonEnd, 20 * 60 + 30) - parseHm(opts.afternoonStart, 16 * 60 + 30))
    );
  }
  return Math.max(60, end - start);
}

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
  opts: JourneyHours & {
    rateWeekday?: number | null;
    rateSaturday?: number | null;
    rateSunday?: number | null;
    rateHoliday?: number | null;
    rateNight?: number | null;
    locationHours?: Record<string, JourneyHours>;
  },
) {
  const weekday = opts.rateWeekday || 150;
  const saturday = opts.rateSaturday || 200;
  const sunday = opts.rateSunday || 200;
  const holiday = opts.rateHoliday || 200;
  const night = opts.rateNight || 200;
  const fallback: JourneyHours = {
    dayStart: opts.dayStart,
    dayEnd: opts.dayEnd,
    afternoonStart: opts.afternoonStart,
    afternoonEnd: opts.afternoonEnd,
  };
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
    const locId = ordered.find((p) => p.work_location_id)?.work_location_id;
    const journey = journeyMinutes((locId && opts.locationHours?.[locId]) || fallback);
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
