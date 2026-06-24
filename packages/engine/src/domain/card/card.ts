/**
 * Hwatu (화투) card — an immutable value object.
 *
 * A card is identified across the wire and the event log by its stable numeric
 * `id` (0..47) only. All gameplay/scoring derives from the static attributes
 * below; nothing about a card ever changes at runtime.
 */

/** 1..12 (월). */
export type Month = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** Stable card identity, 0..47. */
export type CardId = number;

/** 광 / 열끗 / 띠 / 피. */
export type CardCategory = 'BRIGHT' | 'ANIMAL' | 'RIBBON' | 'JUNK';

/**
 * Ribbon (띠) variety.
 * - HONGDAN  홍단 (red, with writing): months 1, 2, 3
 * - CHEONGDAN 청단 (blue): months 6, 9, 10
 * - CHODAN    초단 (plain red): months 4, 5, 7
 * - PLAIN     비띠 (month 12 rain ribbon; not part of 홍/청/초단 sets)
 */
export type RibbonType = 'HONGDAN' | 'CHEONGDAN' | 'CHODAN' | 'PLAIN';

export interface Card {
  readonly id: CardId;
  readonly month: Month;
  readonly category: CardCategory;
  /** Set only when category === 'RIBBON'. */
  readonly ribbon?: RibbonType;
  /** 고도리 bird (열끗 of months 2, 4, 8). */
  readonly isGodori?: boolean;
  /** 비광 — the rain bright (month 12). Affects 광 scoring. */
  readonly isRainBright?: boolean;
  /** 쌍피 — counts as 2 junk (똥쌍피 month 11, 비쌍피 month 12). */
  readonly isDoubleJunk?: boolean;
  /** 국진 — month 9 animal that may be used as a double junk (rule/player choice). */
  readonly isKukjin?: boolean;
}

export const CARD_COUNT = 48;

/** True when this is a 고도리 bird animal. */
export function isGodoriCard(card: Card): boolean {
  return card.category === 'ANIMAL' && card.isGodori === true;
}

/**
 * How many 피 this card is worth when scored as junk.
 * - normal junk: 1
 * - 쌍피: 2
 * - 국진: 0 here (its value depends on the chosen mode; the ScoreCalculator
 *   resolves it in step 7), every other category: 0.
 */
export function junkValueOf(card: Card): number {
  if (card.category !== 'JUNK') return 0;
  return card.isDoubleJunk === true ? 2 : 1;
}
