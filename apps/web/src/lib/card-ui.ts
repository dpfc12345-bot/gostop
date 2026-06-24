import { getCard } from '@gostop/engine';
import type { Card, CardId } from '@gostop/engine';

export function cardLabel(id: CardId): string {
  const c = getCard(id);
  const cat =
    c.category === 'BRIGHT'
      ? '광'
      : c.category === 'ANIMAL'
        ? '열끗'
        : c.category === 'RIBBON'
          ? '띠'
          : '피';
  return `${c.month}월 ${cat}`;
}

export function cardCssClass(card: Card): string {
  switch (card.category) {
    case 'BRIGHT':
      return 'card-bright';
    case 'ANIMAL':
      return 'card-animal';
    case 'RIBBON':
      return 'card-ribbon';
    default:
      return 'card-junk';
  }
}

export function cardCssClassById(id: CardId): string {
  return cardCssClass(getCard(id));
}
