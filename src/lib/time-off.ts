export const TIME_OFF_KIND: Record<string, string> = {
  vacation: "Vacaciones",
  leave: "Licencia",
  sick: "Enfermedad",
  company_off: "Día no laboral (empresa)",
  unjustified: "Falta injustificada",
};

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
