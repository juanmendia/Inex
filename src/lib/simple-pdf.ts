/** Ensambla un PDF 1.4 A4 con Helvetica / Helvetica-Bold (WinAnsi). */

const WIN: Record<string, number> = {
  Á: 0xc1, É: 0xc9, Í: 0xcd, Ó: 0xd3, Ú: 0xda, Ñ: 0xd1, Ü: 0xdc,
  á: 0xe1, é: 0xe9, í: 0xed, ó: 0xf3, ú: 0xfa, ñ: 0xf1, ü: 0xfc,
  "¿": 0xbf, "¡": 0xa1, "°": 0xb0, "–": 0x96, "—": 0x97, "ª": 0xaa, "º": 0xba, "·": 0xb7,
};

export function pdfStr(s: string) {
  let out = "";
  for (const ch of [...s.replace(/\r?\n/g, " ")]) {
    if (ch === "\\" || ch === "(" || ch === ")") out += `\\${ch}`;
    else {
      const c = ch.codePointAt(0) ?? 63;
      if (c < 128) out += ch;
      else {
        const w = WIN[ch] ?? 0x3f;
        out += `\\${w.toString(8).padStart(3, "0")}`;
      }
    }
  }
  return `(${out})`;
}

export function assemblePdf(stream: string) {
  const objs = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >> endobj\n",
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> endobj\n",
    "6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >> endobj\n",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const o of objs) {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += o;
  }
  const xref = Buffer.byteLength(body, "latin1");
  body += `xref\n0 7\n0000000000 65535 f \n`;
  for (let i = 1; i <= 6; i++) body += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  body += `trailer << /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const buf = Buffer.from(body, "latin1");
  if (!buf.toString("latin1").startsWith("%PDF")) throw new Error("PDF inválido");
  return buf;
}

export function receiptPdf(lines: string[]) {
  const cmds = ["BT", "/F1 11 Tf", "50 800 Td"];
  lines.forEach((line, i) => {
    if (i) cmds.push("0 -16 Td");
    cmds.push(`${pdfStr(line.slice(0, 110))} Tj`);
  });
  cmds.push("ET");
  return assemblePdf(cmds.join("\n"));
}
