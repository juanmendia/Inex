import { assemblePdf, pdfStr } from "@/lib/simple-pdf";
import { pesosEnLetras } from "@/lib/pesos-letras";
import { roundMoney } from "@/lib/labels";

export type PayslipLine = {
  code: string;
  concept: string;
  qty?: string;
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
  branch?: string | null;
  category?: string | null;
  lines: PayslipLine[];
  signature?: { name: string; at: string; ip?: string | null; conform: boolean };
};

const COL = { code: 42, concept: 72, cantR: 318, habR: 428, desR: 548 };
const L = 36;
const R = 559;
const W = R - L;

function money(n: number) {
  return roundMoney(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function t(x: number, y: number, s: string, size: number, bold = false) {
  const font = bold ? "/F2" : "/F1";
  return `BT ${font} ${size} Tf 1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm ${pdfStr(s)} Tj ET`;
}

function tr(xRight: number, y: number, s: string, size: number, bold = false) {
  const w = [...s].length * size * (bold ? 0.55 : 0.5);
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

export function payslipPdf(p: Payslip) {
  const earn = p.lines.reduce((a, l) => a + l.earning, 0);
  const ded = p.lines.reduce((a, l) => a + l.deduction, 0);
  const net = roundMoney(earn - ded);
  const ink = "0.10 0.16 0.28";
  const cmds: string[] = [`${ink} RG`, `${ink} rg`, "0.7 w"];

  cmds.push(rect(L, 762, 280, 52));
  cmds.push(rect(316, 762, 243, 52));
  cmds.push(t(L + 8, 794, p.company.slice(0, 36), 12, true));
  if (p.cuit) cmds.push(t(L + 8, 778, `CUIT ${p.cuit}`, 8));
  cmds.push(t(328, 794, p.title.slice(0, 28), 11, true));
  cmds.push(t(328, 776, p.period, 9));

  cmds.push(rect(L, 700, W, 56));
  cmds.push(t(L + 6, 742, "LEGAJO", 6));
  cmds.push(t(L + 6, 726, p.legajo.slice(0, 10), 10, true));
  cmds.push(t(100, 742, "APELLIDO Y NOMBRES", 6));
  cmds.push(t(100, 726, p.name.slice(0, 34), 10, true));
  cmds.push(t(340, 742, "F. INGRESO", 6));
  cmds.push(t(340, 726, p.hireDate ? p.hireDate.slice(0, 10).split("-").reverse().join("/") : "-", 9));
  cmds.push(t(450, 742, "SUC.", 6));
  cmds.push(t(450, 726, (p.branch ?? "-").slice(0, 14), 9));
  cmds.push(t(L + 6, 708, `DNI ${p.dni ?? "-"}`, 8));
  if (p.category) cmds.push(t(180, 708, `CATEGORIA  ${p.category}`.slice(0, 55), 8));

  const headY = 680;
  cmds.push(`${ink} rg`, rect(L, headY, W, 16, true), "1 1 1 rg");
  cmds.push(t(COL.code, headY + 5, "COD", 7, true));
  cmds.push(t(COL.concept, headY + 5, "CONCEPTO", 7, true));
  cmds.push(tr(COL.cantR, headY + 5, "CANT", 7, true));
  cmds.push(tr(COL.habR, headY + 5, "HABERES", 7, true));
  cmds.push(tr(COL.desR, headY + 5, "DESCUENTOS", 7, true));
  cmds.push(`${ink} rg`);

  let y = headY;
  const rowH = 16;
  p.lines.slice(0, 18).forEach((line) => {
    y -= rowH;
    cmds.push(rect(L, y, W, rowH));
    cmds.push(t(COL.code, y + 5, line.code, 8));
    cmds.push(t(COL.concept, y + 5, line.concept.slice(0, 32), 8));
    cmds.push(tr(COL.cantR, y + 5, line.qty ?? "", 8));
    cmds.push(tr(COL.habR, y + 5, line.earning ? money(line.earning) : "", 8));
    cmds.push(tr(COL.desR, y + 5, line.deduction ? money(line.deduction) : "", 8));
  });

  y -= 32;
  cmds.push(rect(L, y, W, 32));
  cmds.push(tr(COL.habR, y + 20, "TOTAL HABERES", 6));
  cmds.push(tr(COL.habR, y + 6, money(earn), 9, true));
  cmds.push(tr(COL.desR, y + 20, "TOTAL DESCUENTOS", 6));
  cmds.push(tr(COL.desR, y + 6, money(ded), 9, true));

  y -= 56;
  cmds.push(rect(L, y, 330, 56));
  cmds.push(rect(366, y, 193, 56));
  const letras = wrap(pesosEnLetras(net), 48);
  letras.forEach((line, i) => cmds.push(t(L + 8, y + 40 - i * 12, line, 8, true)));
  cmds.push(t(L + 8, y + 8, `MES ${p.monthName.toUpperCase()}`, 8));
  cmds.push(t(380, y + 36, "NETO PAGADO", 7));
  cmds.push(t(380, y + 16, `$ ${money(net)}`, 12, true));

  cmds.push(rect(L, 36, 250, 88));
  cmds.push(rect(296, 36, 263, 88));
  cmds.push(t(L + 8, 108, "FIRMA DEL EMPLEADO", 7));
  if (p.signature) {
    cmds.push(t(L + 8, 90, p.signature.name.slice(0, 32), 10, true));
    cmds.push(t(L + 8, 74, p.signature.at.slice(0, 36), 8));
    cmds.push(t(L + 8, 58, p.signature.conform ? "FIRMADO CONFORME" : "FIRMADO NO CONFORME", 8));
    if (p.signature.ip) cmds.push(t(L + 8, 44, `IP ${p.signature.ip}`.slice(0, 28), 7));
  } else {
    cmds.push(t(L + 8, 78, "Pendiente de conformidad", 8));
    cmds.push(t(L + 8, 64, "electronica en el portal.", 8));
  }
  cmds.push(t(304, 108, "EMPLEADOR / RRHH", 7));
  cmds.push(t(304, 78, "Documento generado por Inex", 8));

  return assemblePdf(cmds.join("\n"));
}
