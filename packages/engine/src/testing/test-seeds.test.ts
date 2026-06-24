import { describe, expect, it } from 'vitest';
import { discoverTestSeeds, getE2ESeedCatalog } from './test-seeds.js';

describe('E2E test seed catalog', () => {
  it('finds chongtong within scan range', () => {
    const entries = discoverTestSeeds({ scanLimit: 3000, probePlay: false });
    expect(entries.some((e) => e.tags.includes('chongtong'))).toBe(true);
  });

  it('provides ≥10 playable seeds and special-tag representatives', () => {
    const catalog = getE2ESeedCatalog(true);
    expect(catalog.playableSeeds.length).toBeGreaterThanOrEqual(10);
    expect(catalog.byTag.chongtong).toBeDefined();
    expect(catalog.byTag['shake-offer'] ?? catalog.byTag['bomb-offer']).toBeDefined();
  });
});
