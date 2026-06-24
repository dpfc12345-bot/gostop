import type { CardId } from '@gostop/engine';

/** Shared layout id so cards animate between hand, field, and captured piles. */
export function cardLayoutId(id: CardId): string {
  return `card-${id}`;
}
