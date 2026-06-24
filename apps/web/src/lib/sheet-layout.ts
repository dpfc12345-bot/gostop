import type { CardId } from '@gostop/engine';
import { getCard } from '@gostop/engine';

/**
 * Engine slot order (deck.ts) vs art-sheet column order within a month.
 * Index = engine slot 0..3 → sheet column 0..3 (left to right).
 *
 * 11월 오동: 시트 순서는 광 · 쌍피(아래 빨간) · 피 · 피 — 엔진은 쌍피가 slot 3.
 */
const SHEET_SLOT_BY_MONTH: Partial<Record<number, readonly [number, number, number, number]>> = {
  11: [0, 2, 3, 1],
};

/** Map engine card id → sprite sheet grid cell (8 cols × 6 rows). */
export function engineIdToSheetGrid(id: CardId): { row: number; col: number } {
  const card = getCard(id);
  const monthIndex = card.month - 1;
  const engineSlot = id % 4;
  const slotMap = SHEET_SLOT_BY_MONTH[card.month];
  const sheetSlot = slotMap ? slotMap[engineSlot]! : engineSlot;
  return {
    row: Math.floor(monthIndex / 2),
    col: (monthIndex % 2) * 4 + sheetSlot,
  };
}
