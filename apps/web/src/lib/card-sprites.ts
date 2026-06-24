import type { CardId } from '@gostop/engine';
import { engineIdToSheetGrid } from './sheet-layout.js';

/** Sprite sheet: 8 columns × 6 rows (2 months per row, 4 cards per month). */
export const HWATU_SHEET = {
  url: '/assets/hwatu-sheet.png',
  cols: 8,
  rows: 6,
} as const;

/** Individual card PNG (preferred for rendering — avoids CSS sprite drift). */
export function cardImageUrl(id: CardId): string {
  return `/assets/cards/${id}.png`;
}

/** Map engine card id → grid cell (matches provided 48-card sheet layout). */
export function cardIdToGrid(id: CardId): { row: number; col: number } {
  return engineIdToSheetGrid(id);
}
