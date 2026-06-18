/**
 * Deterministic, seedable PRNG (mulberry32). Injected everywhere in the engine
 * so the same seed + inputs always reproduce the same tournament. Nothing in
 * the engine may call Math.random directly.
 */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Hash an arbitrary string to a 32-bit seed (so seeds can be human-readable). */
export function seedFrom(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
