export function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

/** Valor hora = básico / horas mensuales del convenio (por defecto 176). */
export function hourValue(baseSalary: number, monthlyHours: number) {
  const h = monthlyHours > 0 ? monthlyHours : 176;
  return roundMoney(baseSalary / h);
}

/** Recargo: 100% = hora simple, 150% = extra 50%, 200% = extra 100% / feriado. */
export function overtimeAmount(opts: { hourValue: number; hours: number; ratePercent: number }) {
  return roundMoney(opts.hourValue * opts.hours * (opts.ratePercent / 100));
}

export function overtimeLabel(ratePercent: number) {
  if (ratePercent >= 200) return "Hora extra 200% (domingo / feriado / nocturna)";
  if (ratePercent >= 150) return "Hora extra 150% (hábil / sábado)";
  return "Hora simple 100%";
}

export const RECEIPT_STATUS: Record<string, string> = {
  pending: "Pendiente",
  signed: "Firmado",
  non_conforming: "No conforme",
  expired: "Vencido",
  cancelled: "Anulado",
};

export const TICKET_STATUS: Record<string, string> = {
  open: "Abierta",
  in_progress: "En revisión",
  answered: "Respondida",
  closed: "Cerrada",
};

export const EMPLOYEE_STATUS: Record<string, string> = {
  active: "Activo",
  inactive: "Inactivo",
  suspended: "Suspendido",
};

export const PAYROLL_NOVELTY: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  liquidated: "Liquidada",
};

export const PAYROLL_RUN: Record<string, string> = {
  draft: "Borrador",
  in_review: "En revisión",
  approved: "Aprobada",
  closed: "Cerrada",
  cancelled: "Anulada",
};

export const TENANT_STATUS: Record<string, string> = {
  active: "Activa",
  suspended: "Suspendida",
  cancelled: "Baja",
};
