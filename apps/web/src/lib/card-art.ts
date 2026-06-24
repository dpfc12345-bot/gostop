import { getCard, type Card, type CardId } from '@gostop/engine';

export interface CardArtOptions {
  /** 국진을 피 더미에 둔 경우 — 쌍피(双)가 아닌 2점 피 표시 */
  inJunkPile?: boolean;
}

/** Visual metadata for Hwatu cards (CSS-driven, no image assets). */
export interface CardArt {
  monthLabel: string;
  categoryLabel: string;
  categoryShort: string;
  accent: 'red' | 'blue' | 'gold' | 'neutral';
  pattern: 'bright' | 'animal' | 'ribbon-hong' | 'ribbon-cheong' | 'ribbon-cho' | 'ribbon-plain' | 'junk';
  badge?: string;
  /** True 쌍피 card (11·12월), not 국진-as-피 */
  isSsangPi: boolean;
  isSpecial: boolean;
  hanja: string;
}

const MONTH_KO = ['', '松', '梅', '桜', '黑', '蘭', '菊', '荷', '桂', '菊', '菊', '丹', '桐'] as const;

export function getCardArt(id: CardId, options?: CardArtOptions): CardArt {
  const card = getCard(id);
  const monthLabel = `${card.month}월`;
  const categoryLabel =
    card.category === 'BRIGHT'
      ? '광'
      : card.category === 'ANIMAL'
        ? '열끗'
        : card.category === 'RIBBON'
          ? '띠'
          : '피';

  let pattern: CardArt['pattern'] = 'junk';
  let accent: CardArt['accent'] = 'neutral';
  let badge: string | undefined;

  if (card.category === 'BRIGHT') {
    pattern = 'bright';
    accent = 'gold';
    if (card.isRainBright) badge = '비';
  } else if (card.category === 'ANIMAL') {
    pattern = 'animal';
    accent = card.month <= 6 ? 'red' : 'blue';
    if (card.isGodori) badge = '鳥';
    if (card.isKukjin) badge = options?.inJunkPile ? '2' : '國';
  } else if (card.category === 'RIBBON') {
    if (card.ribbon === 'HONGDAN') pattern = 'ribbon-hong';
    else if (card.ribbon === 'CHEONGDAN') pattern = 'ribbon-cheong';
    else if (card.ribbon === 'CHODAN') pattern = 'ribbon-cho';
    else pattern = 'ribbon-plain';
    accent = card.ribbon === 'CHEONGDAN' ? 'blue' : 'red';
  } else {
    pattern = 'junk';
    accent = card.month % 2 === 0 ? 'blue' : 'red';
    if (card.isDoubleJunk) badge = '双';
  }

  return {
    monthLabel,
    categoryLabel,
    categoryShort: categoryLabel,
    accent,
    pattern,
    badge,
    isSsangPi: card.isDoubleJunk === true,
    isSpecial: card.category === 'BRIGHT' || Boolean(badge),
    hanja: MONTH_KO[card.month] ?? '',
  };
}

export function cardArtClass(card: Card): string {
  if (card.category === 'BRIGHT') return 'hwatu-bright';
  if (card.category === 'ANIMAL') return 'hwatu-animal';
  if (card.category === 'RIBBON') return 'hwatu-ribbon';
  return 'hwatu-junk';
}
