/**
 * Seeded PRNG for the property tests (mulberry32). No `fast-check`: the
 * plan's tactics need only integer choices, and adding a dependency is not
 * this story's decision.
 *
 * Seed from `MIGRATE_SEED` (a number, or `random`); the default is fixed so
 * CI is deterministic. Every failure message should print `seedLabel`.
 */
export interface Prng {
  next(): number;
  int(minInclusive: number, maxInclusive: number): number;
  pick<T>(items: readonly T[]): T;
  bool(p?: number): boolean;
  shuffle<T>(items: readonly T[]): T[];
}

export function seedFromEnv(defaultSeed: number): number {
  const raw = process.env.MIGRATE_SEED;
  if (raw === undefined || raw === "") return defaultSeed;
  if (raw === "random") return Math.floor(Math.random() * 2 ** 32);
  const n = Number(raw);
  return Number.isFinite(n) ? n >>> 0 : defaultSeed;
}

export function prng(seed: number): Prng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number): number => lo + Math.floor(next() * (hi - lo + 1));
  return {
    next,
    int,
    pick: (items) => items[int(0, items.length - 1)],
    bool: (p = 0.5) => next() < p,
    shuffle: (items) => {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i);
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}
