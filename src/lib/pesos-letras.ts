const U = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
const D = ["", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const TEENS = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];
const C = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

function under1000(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const t = Math.floor(r / 10);
  const u = r % 10;
  const parts: string[] = [];
  if (c) parts.push(C[c]!);
  if (r >= 10 && r < 20) parts.push(TEENS[r - 10]!);
  else {
    if (t) parts.push(D[t]! + (u && t !== 1 ? " Y" : ""));
    if (u && r >= 20) parts.push(U[u]!);
    else if (r < 10 && u) parts.push(U[u]!);
  }
  return parts.join(" ").replace(/Y $/, "").trim();
}

function chunk(n: number, singular: string, plural: string) {
  if (!n) return "";
  if (n === 1) return singular === "UN MIL" ? "MIL" : singular;
  return `${under1000(n)} ${plural}`;
}

export function pesosEnLetras(amount: number) {
  const n = Math.round(Math.abs(amount) * 100) / 100;
  const enteros = Math.floor(n);
  const cents = Math.round((n - enteros) * 100);
  if (enteros === 0) return `CERO PESOS CON ${String(cents).padStart(2, "0")}/100`;
  const mill = Math.floor(enteros / 1_000_000);
  const mil = Math.floor((enteros % 1_000_000) / 1000);
  const rest = enteros % 1000;
  const bits = [
    mill ? (mill === 1 ? "UN MILLON" : `${under1000(mill)} MILLONES`) : "",
    chunk(mil, "UN MIL", "MIL"),
    under1000(rest),
  ].filter(Boolean);
  return `SON PESOS ${bits.join(" ").replace(/\s+/g, " ")} CON ${String(cents).padStart(2, "0")}/100`;
}
