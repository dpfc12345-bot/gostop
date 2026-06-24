import { describe, expect, it } from 'vitest';
import { CARD_TABLE, getCard } from './deck.js';
import { isGodoriCard, junkValueOf, type Card } from './card.js';

const by = (pred: (c: Card) => boolean): Card[] => CARD_TABLE.filter(pred);

describe('Hwatu 48-card deck', () => {
  it('has exactly 48 cards with unique ids 0..47', () => {
    expect(CARD_TABLE).toHaveLength(48);
    const ids = new Set(CARD_TABLE.map((c) => c.id));
    expect(ids.size).toBe(48);
    for (let i = 0; i < 48; i++) expect(getCard(i).id).toBe(i);
  });

  it('has 4 cards per month', () => {
    for (let m = 1; m <= 12; m++) {
      expect(by((c) => c.month === m)).toHaveLength(4);
    }
  });

  it('has the correct category composition', () => {
    expect(by((c) => c.category === 'BRIGHT')).toHaveLength(5);
    expect(by((c) => c.category === 'ANIMAL')).toHaveLength(9);
    expect(by((c) => c.category === 'RIBBON')).toHaveLength(10);
    expect(by((c) => c.category === 'JUNK')).toHaveLength(24);
  });

  it('places brights in months 1,3,8,11,12 with the rain bright in month 12', () => {
    expect(by((c) => c.category === 'BRIGHT').map((c) => c.month).sort((a, b) => a - b)).toEqual([
      1, 3, 8, 11, 12,
    ]);
    const rain = by((c) => c.isRainBright === true);
    expect(rain).toHaveLength(1);
    expect(rain[0]!.month).toBe(12);
  });

  it('marks godori as the animals of months 2, 4, 8', () => {
    expect(by(isGodoriCard).map((c) => c.month).sort((a, b) => a - b)).toEqual([2, 4, 8]);
  });

  it('has ribbon sets 홍단/청단/초단 (3 each) + 1 plain rain ribbon', () => {
    expect(by((c) => c.ribbon === 'HONGDAN')).toHaveLength(3);
    expect(by((c) => c.ribbon === 'CHEONGDAN')).toHaveLength(3);
    expect(by((c) => c.ribbon === 'CHODAN')).toHaveLength(3);
    expect(by((c) => c.ribbon === 'PLAIN')).toHaveLength(1);
  });

  it('has two double-junk cards (똥쌍피 m11, 비쌍피 m12) and one kukjin (m9)', () => {
    const doubles = by((c) => c.isDoubleJunk === true);
    expect(doubles.map((c) => c.month).sort((a, b) => a - b)).toEqual([11, 12]);
    doubles.forEach((c) => expect(junkValueOf(c)).toBe(2));

    const kukjin = by((c) => c.isKukjin === true);
    expect(kukjin).toHaveLength(1);
    expect(kukjin[0]!.month).toBe(9);
    expect(kukjin[0]!.category).toBe('ANIMAL');
  });

  it('totals 26 junk-points across all junk cards (22 single + 2 double)', () => {
    const total = CARD_TABLE.reduce((sum, c) => sum + junkValueOf(c), 0);
    expect(total).toBe(26);
  });
});
