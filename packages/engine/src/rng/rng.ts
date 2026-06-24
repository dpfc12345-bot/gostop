/**
 * Deterministic, seedable PRNG.
 *
 * The engine never touches global randomness. A seeded Rng is injected so a
 * whole game is reproducible from its seed alone — the deal and draw-pile order
 * are a pure function of (seed). Combined with the action/event log this gives
 * 100% replay for spectating, CS and anti-cheat.
 *
 * Algorithm: mulberry32 — tiny, fast, well-distributed for game shuffling.
 * (Not cryptographically secure; that is intentional and sufficient here.)
 */

export interface Rng {
  /** Next unsigned 32-bit integer. */
  nextUint32(): number;
  /** Next float in [0, 1). */
  nextFloat(): number;
  /** Uniform integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
}

/** Hash an arbitrary string seed to a uint32 (xfnv1a). */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function normalizeSeed(seed: number | string): number {
  if (typeof seed === 'number') {
    return seed >>> 0;
  }
  return hashSeed(seed);
}

/** Create a deterministic PRNG from a numeric or string seed. */
export function createSeededRng(seed: number | string): Rng {
  let a = normalizeSeed(seed);

  const nextUint32 = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };

  const nextFloat = (): number => nextUint32() / 0x1_0000_0000;

  const nextInt = (maxExclusive: number): number => {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError(`maxExclusive must be a positive integer, got ${maxExclusive}`);
    }
    return Math.floor(nextFloat() * maxExclusive);
  };

  return { nextUint32, nextFloat, nextInt };
}

/**
 * Pure Fisher–Yates shuffle. Returns a NEW array; does not mutate the input.
 * Given the same input and an Rng at the same state, output is deterministic.
 */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const tmp = result[i] as T;
    result[i] = result[j] as T;
    result[j] = tmp;
  }
  return result;
}
