import { describe, expect, it } from 'vitest';
import { createSeededRng, shuffle } from './rng.js';
import { ORDERED_CARD_IDS } from '../domain/card/deck.js';

describe('seeded RNG determinism', () => {
  it('produces an identical sequence for the same seed', () => {
    const a = createSeededRng('game-42');
    const b = createSeededRng('game-42');
    const seqA = Array.from({ length: 20 }, () => a.nextUint32());
    const seqB = Array.from({ length: 20 }, () => b.nextUint32());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = Array.from({ length: 20 }, ((r) => () => r.nextUint32())(createSeededRng('seed-A')));
    const b = Array.from({ length: 20 }, ((r) => () => r.nextUint32())(createSeededRng('seed-B')));
    expect(a).not.toEqual(b);
  });

  it('numeric and string seeds both work; nextInt stays in range', () => {
    const r = createSeededRng(123456);
    for (let i = 0; i < 1000; i++) {
      const n = r.nextInt(48);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(48);
    }
  });
});

describe('shuffle', () => {
  it('is a pure permutation (does not mutate input, preserves multiset)', () => {
    const input = ORDERED_CARD_IDS;
    const before = [...input];
    const out = shuffle(input, createSeededRng('shuffle-1'));
    expect(input).toEqual(before); // input untouched
    expect(out).toHaveLength(input.length);
    expect([...out].sort((a, b) => a - b)).toEqual([...input].sort((a, b) => a - b));
  });

  it('same seed yields the same shuffle (replayable deal)', () => {
    const s1 = shuffle(ORDERED_CARD_IDS, createSeededRng('deal-seed'));
    const s2 = shuffle(ORDERED_CARD_IDS, createSeededRng('deal-seed'));
    expect(s1).toEqual(s2);
  });
});
