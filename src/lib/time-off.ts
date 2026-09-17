import { LEAVE_CATALOG } from "@/lib/leave-catalog";

export const TIME_OFF_KIND: Record<string, string> = Object.fromEntries(LEAVE_CATALOG.map((t) => [t.code, t.name]));

export const TIME_OFF_STATUS: Record<string, string> = {
  pending: "Pendiente",
  approved: "Autorizada",
  rejected: "Rechazada",
  cancelled: "Cancelada",
};

export function datesInRange(start: string, end: string) {
  const out: string[] = [];
  const a = new Date(start + "T12:00:00");
  const b = new Date(end + "T12:00:00");
  for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function isWeekday(iso: string) {
  const d = new Date(iso + "T12:00:00").getDay();
  return d >= 1 && d <= 5;
}

export function coversDay(row: { starts_on: string; ends_on: string }, iso: string) {
  return iso >= row.starts_on && iso <= row.ends_on;
}

export const TIME_OFF_PORTION: Record<string, string> = {
  full: "Día completo",
  morning: "Solo mañana",
  afternoon: "Solo tarde",
};

export function readPortion(formData: FormData, starts: string, ends: string) {
  const p = String(formData.get("portion") ?? "full");
  if (ends && ends !== starts) return "full";
  if (p === "morning" || p === "afternoon") return p;
  return "full";
}
