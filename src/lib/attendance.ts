export function isPunchOut(row: { punch_type?: string | null; method?: string | null }) {
  return row.punch_type === "out" || row.method === "missing_out" || row.method === "scheduled_out" || String(row.method ?? "").endsWith(":out");
}

export function baYmd(iso?: string | number | Date) {
  return new Date(iso ?? Date.now()).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

export function laterHm(...vals: (string | null | undefined)[]) {
  let best: string | null = null;
  for (const v of vals) {
    const t = String(v ?? "").slice(0, 5);
    if (!/^\d{2}:\d{2}$/.test(t)) continue;
    if (!best || t > best) best = t;
  }
  return best;
}

/** Argentina sin DST. */
export function atBuenosAires(ymd: string, hm: string) {
  return new Date(`${ymd}T${String(hm).slice(0, 5)}:00-03:00`);
}

/** datetime-local del browser: siempre hora de Argentina, no la del servidor UTC. */
export function baDateTime(local: string) {
  const m = String(local).trim().match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (!m) return new Date(NaN);
  return atBuenosAires(m[1]!, m[2]!);
}

export function viaticNoveltyNote(ymd: string) {
  return `viatico|${ymd}`;
}
