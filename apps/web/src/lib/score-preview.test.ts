import { describe, expect, it } from 'vitest';
import { previewScoreFromCapture } from './score-preview.js';

describe('previewScoreFromCapture', () => {
  it('scores captured piles using engine rules', () => {
    const breakdown = previewScoreFromCapture({
      rulePreset: 'PMANG_NEWMATGO',
      seat: 0,
      captured: {
        brights: [0, 8, 16],
        animals: [],
        ribbons: [],
        junk: [2, 3, 6, 7, 10, 11, 14, 15, 18, 19],
      },
      goCount: 0,
      hasShaken: false,
    });
    expect(breakdown.total).toBeGreaterThan(0);
    expect(breakdown.components.some((c) => c.code.startsWith('GWANG'))).toBe(true);
  });
});
