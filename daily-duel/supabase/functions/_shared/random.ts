/**
 * Deterministischer Zufall. Wichtig, weil eine synthetische Gegnerspur aus
 * (Set-ID, Elo, Seed) reproduzierbar sein muss: derselbe Übungsgegner soll bei
 * einem Retry nicht plötzlich anders spielen.
 */

/** mulberry32 – klein, schnell, für Spiellogik völlig ausreichend. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Streut einen String in einen 32-Bit-Seed (FNV-1a). */
export function seedFrom(...parts: (string | number)[]): number {
  let hash = 2166136261;
  for (const part of parts) {
    const text = String(part);
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  }
  return hash >>> 0;
}

/** Standardnormalverteilte Zufallszahl (Box-Muller). */
export function gaussian(rng: () => number): number {
  const u = Math.max(rng(), Number.EPSILON);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
