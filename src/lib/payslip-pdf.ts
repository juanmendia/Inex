import { assemblePdf, pdfStr } from "@/lib/simple-pdf";
import { pesosEnLetras } from "@/lib/pesos-letras";
import { roundMoney } from "@/lib/labels";

export type PayslipLine = {
  code: string;
  concept: string;
  ref?: string;
  qty?: string;
  unit?: string;
  earning: number;
  deduction: number;
};

export type Payslip = {
  company: string;
  cuit?: string | null;
  title: string;
  period: string;
  monthName: string;
  legajo: string;
  name: string;
  dni?: string | null;
  hireDate?: string | null;
  payDate?: string | null;
  branch?: string | null;
  category?: string | null;
  lines: PayslipLine[];
  signature?: { name: string; at: string; ip?: string | null; conform: boolean };
};

const L = 32;
const R = 563;
const W = R - L;
const COL = { code: 36, concept: 68, ref: 248, cant: 318, unit: 352, hab: 430, des: 548 };

function money(n: number) {
  return roundMoney(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function t(x: number, y: number, s: string, size: number, bold = false) {
  const font = bold ? "/F2" : "/F1";
  return `BT ${font} ${size} Tf 1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm ${pdfStr(s)} Tj ET`;
}

function signName(x: number, y: number, s: string, size: number) {
  return `BT /F3 ${size} Tf 1 0 0.22 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm ${pdfStr(s)} Tj ET`;
}

function tr(xRight: number, y: number, s: string, size: number, bold = false) {
  const w = [...s].length * size * (bold ? 0.52 : 0.48);
  return t(xRight - w, y, s, size, bold);
}

function rect(x: number, y: number, w: number, h: number, fill = false) {
  return `${x} ${y} ${w} ${h} re ${fill ? "f" : "S"}`;
}

function wrap(s: string, max: number) {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

function dmy(iso?: string | null) {
  if (!iso) return "—";
  if (iso.includes("/")) return iso;
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y.slice(2)}`;
}

export function payslipPdf(p: Payslip) {
  const earn = p.lines.reduce((a, l) => a + l.earning, 0);
  const ded = p.lines.reduce((a, l) => a + l.deduction, 0);
  const net = roundMoney(earn - ded);
  const ink = "0.12 0.14 0.18";
  const hair = "0.86 0.87 0.88";
  const cmds: string[] = [`${ink} RG`, `${ink} rg`, "0.45 w"];

  cmds.push(rect(L, 768, 300, 48));
  cmds.push(rect(336, 768, 227, 48));
  cmds.push(t(L + 8, 798, p.company.slice(0, 42).toUpperCase(), 11, true));
  cmds.push(t(L + 8, 782, p.cuit ? `CUIT ${p.cuit}` : "CUIT —", 8));
  cmds.push(t(344, 798, p.title.slice(0, 26), 10, true));
  cmds.push(t(344, 782, "ART. 140 L.C.T.", 8));

  cmds.push(rect(L, 708, W, 54));
  cmds.push(t(L + 6, 748, "LEGAJO N.", 6));
  cmds.push(t(L + 6, 732, p.legajo.slice(0, 12), 10, true));
  cmds.push(t(110, 748, "APELLIDO Y NOMBRES", 6));
  cmds.push(t(110, 732, p.name.slice(0, 36).toUpperCase(), 10, true));
  cmds.push(t(360, 748, "F. INGRESO", 6));
  cmds.push(t(360, 732, dmy(p.hireDate), 9));
  cmds.push(t(460, 748, "SUC.", 6));
  cmds.push(t(460, 732, (p.branch ?? "—").slice(0, 14).toUpperCase(), 9));
  cmds.push(t(L + 6, 716, `CUIL / DNI  ${p.dni ?? "—"}`, 8));
  cmds.push(t(250, 716, `CATEGORIA  ${(p.category ?? "—").slice(0, 42).toUpperCase()}`, 8));

  const headY = 690;
  const tableBottom = 268;
  cmds.push("0.94 g", rect(L, headY, W, 14, true), `${ink} rg`);
  cmds.push(t(COL.code, headY + 4, "COD", 6, true));
  cmds.push(t(COL.concept, headY + 4, "CONCEPTO", 6, true));
  cmds.push(t(COL.ref, headY + 4, "REFERENCIA", 6, true));
  cmds.push(tr(COL.cant, headY + 4, "CANT", 6, true));
  cmds.push(t(COL.unit, headY + 4, "UN.", 6, true));
  cmds.push(tr(COL.hab, headY + 4, "HABERES", 6, true));
  cmds.push(tr(COL.des, headY + 4, "DESCUENTOS", 6, true));

  let y = headY;
  const rowH = 13;
  const lines = p.lines.slice(0, 22);
  cmds.push("0.22 w", `${hair} RG`);
  for (const line of lines) {
    y -= rowH;
    cmds.push(`${L} ${y} m ${L + W} ${y} l S`);
    cmds.push(`${ink} rg`);
    cmds.push(t(COL.code, y + 4, line.code, 7));
    cmds.push(t(COL.concept, y + 4, line.concept.slice(0, 28), 7));
    cmds.push(t(COL.ref, y + 4, (line.ref ?? "").slice(0, 12), 7));
    cmds.push(tr(COL.cant, y + 4, line.qty ?? "", 7));
    cmds.push(t(COL.unit, y + 4, (line.unit ?? "").slice(0, 4), 7));
    cmds.push(tr(COL.hab, y + 4, line.earning ? money(line.earning) : "", 7));
    cmds.push(tr(COL.des, y + 4, line.deduction ? money(line.deduction) : "", 7));
    cmds.push(`${hair} RG`);
  }
  while (y > tableBottom) {
    y -= rowH;
    cmds.push(`${L} ${y} m ${L + W} ${y} l S`);
  }
  cmds.push("0.45 w", `${ink} RG`, `${ink} rg`);
  cmds.push(rect(L, tableBottom, W, headY + 14 - tableBottom));

  cmds.push(rect(L, 228, W, 36));
  cmds.push(tr(COL.hab, 248, "TOTAL HABERES", 6));
  cmds.push(tr(COL.hab, 234, `$ ${money(earn)}`, 10, true));
  cmds.push(tr(COL.des, 248, "TOTAL DESCUENTOS", 6));
  cmds.push(tr(COL.des, 234, `$ ${money(ded)}`, 10, true));

  cmds.push(rect(L, 168, 175, 54));
  cmds.push(rect(211, 168, 175, 54));
  cmds.push(rect(390, 168, 173, 54));
  cmds.push(t(L + 8, 206, "PERIODO", 6));
  cmds.push(t(L + 8, 188, p.period, 11, true));
  cmds.push(t(219, 206, "FECHA DE PAGO", 6));
  cmds.push(t(219, 188, p.payDate ?? p.period, 11, true));
  cmds.push(t(398, 206, "MES", 6));
  cmds.push(t(398, 188, p.monthName.toUpperCase(), 10, true));

  cmds.push(rect(L, 108, W, 54));
  const letras = wrap(pesosEnLetras(net), 70);
  cmds.push(t(L + 8, 146, "SON PESOS NETOS", 6));
  letras.forEach((line, i) => cmds.push(t(L + 8, 130 - i * 11, line, 8, true)));
  cmds.push(tr(R - 8, 128, `$ ${money(net)}`, 12, true));
  cmds.push(tr(R - 8, 146, "NETO PAGADO", 6));

  cmds.push(rect(L, 32, 255, 70));
  cmds.push(rect(291, 32, 272, 70));
  cmds.push(t(L + 8, 88, "FIRMA DEL EMPLEADO", 6));
  if (p.signature) {
    const pretty = p.signature.name.includes(",")
      ? p.signature.name.split(",").reverse().map((x) => x.trim()).join(" ")
      : p.signature.name;
    cmds.push("0.25 w", `${L + 10} 52 m ${L + 200} 52 l S`, "0.45 w");
    cmds.push(signName(L + 12, 58, pretty.slice(0, 28), 16));
    cmds.push(t(L + 8, 40, `${p.signature.conform ? "Firma electronica conforme" : "Firma electronica no conforme"} · ${p.signature.at.slice(0, 22)}`, 6));
  } else {
    cmds.push(t(L + 8, 62, "Pendiente de conformidad electronica", 7));
    cmds.push(t(L + 8, 48, "en el portal Inex.", 7));
  }
  cmds.push(t(299, 88, "OBSERVACIONES / ACREDITADO EN", 6));
  cmds.push(t(299, 70, "Liquidacion generada por el empleador.", 7));
  cmds.push(t(299, 56, "Art. 140 y 138 L.C.T. Recibo de haberes.", 7));
  cmds.push(t(299, 42, "Documento generado por Inex RRHH.", 7));

  return assemblePdf(cmds.join("\n"));
}
