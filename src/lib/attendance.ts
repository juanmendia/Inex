export function isPunchOut(row: { punch_type?: string | null; method?: string | null }) {
  return row.punch_type === "out" || row.method === "missing_out" || String(row.method ?? "").endsWith(":out");
}
