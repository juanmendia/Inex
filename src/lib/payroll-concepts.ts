import { roundMoney } from "@/lib/labels";
import type { PayslipLine } from "@/lib/payslip-pdf";

export type PayrollConcept = {
  code: string;
  name: string;
  side: "earn" | "ded";
  rate?: number;
  auto?: "base" | "sac" | "stat";
};

/** Códigos de liquidación (estilo recibo bancario / LCT). */
export const PAYROLL_CONCEPTS: PayrollConcept[] = [
  { code: "004", name: "SALARIO BASICO", side: "earn", auto: "base" },
  { code: "007", name: "ADICIONAL EMPRESA", side: "earn" },
  { code: "110", name: "HORAS EXTRAS 50%", side: "earn" },
  { code: "111", name: "HORAS EXTRAS 100%", side: "earn" },
  { code: "112", name: "HORAS NOCTURNAS", side: "earn" },
  { code: "120", name: "FERIADO TRABAJADO", side: "earn" },
  { code: "200", name: "PREMIO / BONIFICACION", side: "earn" },
  { code: "210", name: "VIATICO", side: "earn" },
  { code: "500", name: "SAC / AGUINALDO", side: "earn", auto: "sac" },
  { code: "750", name: "TICKET / LUNCH", side: "earn" },
  { code: "800", name: "AP. JUBILATORIO", side: "ded", rate: 0.11, auto: "stat" },
  { code: "802", name: "CUOTA SINDICAL", side: "ded" },
  { code: "804", name: "LEY 19.032 INSSJP", side: "ded", rate: 0.03, auto: "stat" },
  { code: "806", name: "OBRA SOCIAL", side: "ded", rate: 0.03, auto: "stat" },
  { code: "807", name: "SEG. VIDA OBLIG.", side: "ded" },
  { code: "900", name: "IMPUESTO GANANCIAS", side: "ded" },
];

export function conceptByCode(code: string) {
  return PAYROLL_CONCEPTS.find((c) => c.code === code);
}

export function overtimeConcept(ratePercent: number) {
  if (ratePercent >= 200) return PAYROLL_CONCEPTS.find((c) => c.code === "111")!;
  if (ratePercent >= 150) return PAYROLL_CONCEPTS.find((c) => c.code === "110")!;
  return PAYROLL_CONCEPTS.find((c) => c.code === "004")!;
}

function parseExtra(concept: string) {
  const m = concept.trim().match(/^(\d{3})\b\s*(.*)$/);
  if (m) return { code: m[1]!, rest: m[2]!.trim() };
  const u = concept.toUpperCase();
  if (/150|50 %|HABIL|SABADO/.test(u) && /EXTRA/.test(u)) return { code: "110", rest: "" };
  if (/200|100 %|DOMINGO|FERIADO|NOCTURN/.test(u) && /EXTRA|HORA/.test(u)) return { code: "111", rest: "" };
  if (/SAC|AGUINALDO/.test(u)) return { code: "500", rest: "" };
  if (/JUBIL/.test(u)) return { code: "800", rest: "" };
  if (/INSSJP|19\.032|PAMI/.test(u)) return { code: "804", rest: "" };
  if (/OBRA SOCIAL/.test(u)) return { code: "806", rest: "" };
  if (/GANANCIA/.test(u)) return { code: "900", rest: "" };
  if (/SINDICAL|CUOTA/.test(u)) return { code: "802", rest: "" };
  if (/PREMIO|BONIF/.test(u)) return { code: "200", rest: "" };
  if (/VIAT/.test(u)) return { code: "210", rest: "" };
  if (/LUNCH|TICKET/.test(u)) return { code: "750", rest: "" };
  return { code: "007", rest: concept };
}

export function buildPayslipLines(opts: {
  kind: string;
  base: number;
  month: number;
  extras: { concept: string; amount: number; hours: number | null }[];
}): PayslipLine[] {
  const rows: PayslipLine[] = [];
  const used = new Set<string>();

  if (opts.kind === "aguinaldo") {
    const fromNov = opts.extras.find((n) => parseExtra(n.concept).code === "500" || /sac|aguinaldo/i.test(n.concept));
    const amount = fromNov ? Number(fromNov.amount) : roundMoney(opts.base / 2);
    rows.push({
      code: "500",
      concept: opts.month === 6 ? "SAC / AGUINALDO 1RA. CUOTA" : "SAC / AGUINALDO 2DA. CUOTA",
      qty: "1",
      unit: "MES",
      earning: amount,
      deduction: 0,
    });
    used.add("500");
  } else {
    if (opts.base > 0) {
      rows.push({ code: "004", concept: "SALARIO BASICO", qty: "1", unit: "MES", earning: opts.base, deduction: 0 });
      used.add("004");
    }
    for (const n of opts.extras) {
      const parsed = parseExtra(n.concept);
      if (parsed.code === "500") continue;
      const cat = conceptByCode(parsed.code);
      const amt = Number(n.amount ?? 0);
      const earn = cat?.side === "ded" || amt < 0 ? 0 : Math.abs(amt);
      const ded = cat?.side === "ded" || amt < 0 ? Math.abs(amt) : 0;
      rows.push({
        code: parsed.code,
        concept: (cat?.name || parsed.rest || n.concept).toUpperCase(),
        qty: n.hours ? String(n.hours) : amt ? "1" : "",
        unit: n.hours ? "HS" : "",
        earning: earn,
        deduction: ded,
      });
      used.add(parsed.code);
    }
  }

  const taxable = rows.reduce((a, l) => a + l.earning, 0);
  if (taxable > 0) {
    for (const c of PAYROLL_CONCEPTS.filter((x) => x.auto === "stat" && x.rate)) {
      if (used.has(c.code)) continue;
      rows.push({
        code: c.code,
        concept: c.name,
        qty: `${Math.round(c.rate! * 100)}`,
        unit: "%",
        earning: 0,
        deduction: roundMoney(taxable * c.rate!),
      });
    }
  }
  return rows;
}
