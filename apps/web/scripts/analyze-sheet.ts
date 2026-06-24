/**
 * Analyze hwatu sprite sheet to find card cell boundaries.
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHEET = join(__dirname, '../public/assets/hwatu-sheet.png');

function isRed(r: number, g: number, b: number): boolean {
  return r > 160 && g < 90 && b < 90;
}

function isWhite(r: number, g: number, b: number): boolean {
  return r > 230 && g > 230 && b > 230;
}

async function main(): Promise<void> {
  const img = sharp(SHEET);
  const meta = await img.metadata();
  const W = meta.width!;
  const H = meta.height!;
  const { data } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const rowRed: number[] = [];
  for (let y = 0; y < H; y++) {
    let count = 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (isRed(data[i]!, data[i + 1]!, data[i + 2]!)) count++;
    }
    rowRed.push(count);
  }

  const colRed: number[] = [];
  for (let x = 0; x < W; x++) {
    let count = 0;
    for (let y = 0; y < H; y++) {
      const i = (y * W + x) * 4;
      if (isRed(data[i]!, data[i + 1]!, data[i + 2]!)) count++;
    }
    colRed.push(count);
  }

  function findBands(counts: number[], minGap: number, threshold: number): number[] {
    const bands: number[] = [];
    let inBand = false;
    let start = 0;
    for (let i = 0; i < counts.length; i++) {
      const active = counts[i]! > threshold;
      if (active && !inBand) {
        start = i;
        inBand = true;
      } else if (!active && inBand) {
        if (i - start > minGap) bands.push(start, i);
        inBand = false;
      }
    }
    if (inBand) bands.push(start, counts.length);
    return bands;
  }

  // White gutter valleys between cards
  const rowWhite: number[] = [];
  for (let y = 0; y < H; y++) {
    let count = 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (isWhite(data[i]!, data[i + 1]!, data[i + 2]!)) count++;
    }
    rowWhite.push(count);
  }

  const colWhite: number[] = [];
  for (let x = 0; x < W; x++) {
    let count = 0;
    for (let y = 0; y < H; y++) {
      const i = (y * W + x) * 4;
      if (isWhite(data[i]!, data[i + 1]!, data[i + 2]!)) count++;
    }
    colWhite.push(count);
  }

  console.log(`Sheet: ${W}×${H}`);

  // Find horizontal white gutters (full-width white rows)
  const hGutters: number[] = [];
  for (let y = 1; y < H - 1; y++) {
    if (rowWhite[y]! > W * 0.85 && rowWhite[y - 1]! < W * 0.5) hGutters.push(y);
  }
  console.log('H gutters:', hGutters);

  const vGutters: number[] = [];
  for (let x = 1; x < W - 1; x++) {
    if (colWhite[x]! > H * 0.85 && colWhite[x - 1]! < H * 0.5) vGutters.push(x);
  }
  console.log('V gutters:', vGutters);

  // Red border outer edges per row scan at mid-height of first cell
  const rowBands = findBands(rowRed, 20, H * 0.15);
  console.log('Row red bands:', rowBands);

  const colBands = findBands(colRed, 10, W * 0.08);
  console.log('Col red bands (first 32):', colBands.slice(0, 32));
}

main();
