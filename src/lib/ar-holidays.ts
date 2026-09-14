/** Feriados nacionales AR (fecha fija + unos móviles 2025–2027). ponytail: no cubre feriados locales; se pueden corregir a mano en la novedad. */
const EXTRA = ["2025-04-17", "2025-04-18", "2026-04-02", "2026-04-03", "2027-03-25", "2027-03-26"];

export function isArHoliday(isoDate: string) {
  const [, m, d] = isoDate.split("-").map(Number);
  const fixed =
    (m === 1 && d === 1) ||
    (m === 3 && d === 24) ||
    (m === 4 && d === 2) ||
    (m === 5 && (d === 1 || d === 25)) ||
    (m === 6 && (d === 17 || d === 20)) ||
    (m === 7 && d === 9) ||
    (m === 8 && d === 17) ||
    (m === 10 && d === 12) ||
    (m === 11 && d === 20) ||
    (m === 12 && (d === 8 || d === 25));
  return fixed || EXTRA.includes(isoDate);
}

export function buenosAiresDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

export function buenosAiresMinutes(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const min = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + min;
}
