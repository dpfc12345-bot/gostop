import { describe, expect, it } from 'vitest';
import { cardIdToGrid, cardImageUrl } from './card-sprites.js';

describe('card-sprites', () => {
  it('builds card image URL from id', () => {
    expect(cardImageUrl(0)).toBe('/assets/cards/0.png');
    expect(cardImageUrl(47)).toBe('/assets/cards/47.png');
  });

  it('maps id 0 to January bright (row 0, col 0)', () => {
    expect(cardIdToGrid(0)).toEqual({ row: 0, col: 0 });
  });

  it('maps id 4 to February first card (row 0, col 4)', () => {
    expect(cardIdToGrid(4)).toEqual({ row: 0, col: 4 });
  });

  it('maps id 47 to December last card (row 5, col 7)', () => {
    expect(cardIdToGrid(47)).toEqual({ row: 5, col: 7 });
  });

  it('maps 11월 쌍피 (id 43) to the red-bottom sheet cell (col 1)', () => {
    expect(cardIdToGrid(43)).toEqual({ row: 5, col: 1 });
  });

  it('maps default months by engine slot order', () => {
    expect(cardIdToGrid(32)).toEqual({ row: 4, col: 0 });
    expect(cardIdToGrid(33)).toEqual({ row: 4, col: 1 });
  });
});
