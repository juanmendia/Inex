/** Distancia típica FaceAPI: < 0.5 muy parecido, 0.6 límite habitual, > 0.6 otra persona. */
export const FACE_MATCH_MAX = 0.58;

export function parseDescriptor(raw: unknown): number[] | null {
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(raw) || raw.length < 100) return null;
  const nums = raw.map((n) => Number(n));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  return nums;
}

export function faceDistance(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  let s = 0;
  for (let i = 0; i < n; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    s += d * d;
  }
  return Math.sqrt(s);
}
