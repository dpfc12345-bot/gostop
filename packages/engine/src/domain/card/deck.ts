/**
 * The canonical 48-card Hwatu deck.
 *
 * The deck is built from a compact per-month specification so the data is easy
 * to audit. `id = (month - 1) * 4 + slot`, giving stable ids 0..47.
 *
 * Composition (audited): 광 5 (months 1,3,8,11,12 — 12 is 비광), 열끗 9
 * (2,4,5,6,7,8,9,10,12), 띠 10 (1,2,3,4,5,6,7,9,10,12), 피 24. Double junk
 * (쌍피): 똥쌍피 (month 11) + 비쌍피 (month 12). 국진 (month 9 animal) is a
 * convertible double junk handled by the rules. These invariants are locked by
 * unit tests in step 5.
 */
import type { Card, CardId, Month } from './card.js';

interface CardSpec {
  category: Card['category'];
  ribbon?: Card['ribbon'];
  godori?: boolean;
  rainBright?: boolean;
  doubleJunk?: boolean;
  kukjin?: boolean;
}

const JUNK: CardSpec = { category: 'JUNK' };

// Index 0..11 corresponds to months 1..12. Exactly 4 cards per month.
const MONTH_SPECS: readonly (readonly [CardSpec, CardSpec, CardSpec, CardSpec])[] = [
  /* 1  송학  */ [{ category: 'BRIGHT' }, { category: 'RIBBON', ribbon: 'HONGDAN' }, JUNK, JUNK],
  /* 2  매조  */ [{ category: 'ANIMAL', godori: true }, { category: 'RIBBON', ribbon: 'HONGDAN' }, JUNK, JUNK],
  /* 3  벚꽃  */ [{ category: 'BRIGHT' }, { category: 'RIBBON', ribbon: 'HONGDAN' }, JUNK, JUNK],
  /* 4  흑싸리 */ [{ category: 'ANIMAL', godori: true }, { category: 'RIBBON', ribbon: 'CHODAN' }, JUNK, JUNK],
  /* 5  난초  */ [{ category: 'ANIMAL' }, { category: 'RIBBON', ribbon: 'CHODAN' }, JUNK, JUNK],
  /* 6  모란  */ [{ category: 'ANIMAL' }, { category: 'RIBBON', ribbon: 'CHEONGDAN' }, JUNK, JUNK],
  /* 7  홍싸리 */ [{ category: 'ANIMAL' }, { category: 'RIBBON', ribbon: 'CHODAN' }, JUNK, JUNK],
  /* 8  공산  */ [{ category: 'BRIGHT' }, { category: 'ANIMAL', godori: true }, JUNK, JUNK],
  /* 9  국화  */ [{ category: 'ANIMAL', kukjin: true }, { category: 'RIBBON', ribbon: 'CHEONGDAN' }, JUNK, JUNK],
  /* 10 단풍  */ [{ category: 'ANIMAL' }, { category: 'RIBBON', ribbon: 'CHEONGDAN' }, JUNK, JUNK],
  /* 11 오동  */ [{ category: 'BRIGHT' }, JUNK, JUNK, { category: 'JUNK', doubleJunk: true }],
  /* 12 비    */ [{ category: 'BRIGHT', rainBright: true }, { category: 'ANIMAL' }, { category: 'RIBBON', ribbon: 'PLAIN' }, { category: 'JUNK', doubleJunk: true }],
];

function buildDeck(): readonly Card[] {
  const cards: Card[] = [];
  MONTH_SPECS.forEach((specs, monthIndex) => {
    const month = (monthIndex + 1) as Month;
    specs.forEach((spec, slot) => {
      const card: Card = {
        id: monthIndex * 4 + slot,
        month,
        category: spec.category,
        ...(spec.ribbon !== undefined ? { ribbon: spec.ribbon } : {}),
        ...(spec.godori === true ? { isGodori: true } : {}),
        ...(spec.rainBright === true ? { isRainBright: true } : {}),
        ...(spec.doubleJunk === true ? { isDoubleJunk: true } : {}),
        ...(spec.kukjin === true ? { isKukjin: true } : {}),
      };
      cards.push(card);
    });
  });
  return cards;
}

/** All 48 cards, indexed by id. */
export const CARD_TABLE: readonly Card[] = buildDeck();

/** Canonical ordered ids 0..47 (pre-shuffle). */
export const ORDERED_CARD_IDS: readonly CardId[] = CARD_TABLE.map((c) => c.id);

/** Look up a card by id. Throws on an invalid id (defensive; ids come from trusted state). */
export function getCard(id: CardId): Card {
  const card = CARD_TABLE[id];
  if (card === undefined) {
    throw new RangeError(`invalid card id: ${id}`);
  }
  return card;
}

/** Resolve many ids to cards. */
export function getCards(ids: readonly CardId[]): Card[] {
  return ids.map(getCard);
}
