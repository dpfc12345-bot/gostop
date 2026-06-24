/**
 * Detect exact column/row boundaries from white gutters in the sprite sheet.
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHEET = join(__dirname, '../public/assets/hwatu-sheet.png');
const OUT = join(__dirname, '../public/assets/sheet-grid.json');

function isWhite(r: number, g: number, b: number): boolean {
  return r > 235 && g > 235 && b > 235;
}

async function main(): Promise<void> {
  const img = sharp(SHEET);
  const meta = await img.metadata();
  const W = meta.width!;
  const H = meta.height!;
  const { data } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const colWhite: number[] = [];
  for (let x = 0; x < W; x++) {
    let count = 0;
    for (let y = 0; y < H; y++) {
      const i = (y * W + x) * 4;
      if (isWhite(data[i]!, data[i + 1]!, data[i + 2]!)) count++;
    }
    colWhite.push(count);
  }

  const rowWhite: number[] = [];
  for (let y = 0; y < H; y++) {
    let count = 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (isWhite(data[i]!, data[i + 1]!, data[i + 2]!)) count++;
    }
    rowWhite.push(count);
  }

  function clusterGutters(counts: number[], threshold: number, minGap: number): number[] {
    const raw: number[] = [];
    for (let i = 1; i < counts.length - 1; i++) {
      if (counts[i]! >= threshold) raw.push(i);
    }
    if (raw.length === 0) return [];

    const clusters: number[][] = [[raw[0]!]];
    for (let i = 1; i < raw.length; i++) {
      const prev = clusters[clusters.length - 1]!;
      if (raw[i]! - prev[prev.length - 1]! <= minGap) prev.push(raw[i]!);
      else clusters.push([raw[i]!]);
    }
    return clusters.map((c) => Math.round(c.reduce((a, b) => a + b, 0) / c.length));
  }

  const colGutters = clusterGutters(colWhite, H * 0.88, 3);
  const rowGutters = clusterGutters(rowWhite, W * 0.88, 3);

  const colBounds = [0, ...colGutters, W];
  const rowBounds = [0, ...rowGutters, H];

  console.log(`Sheet ${W}×${H}`);
  console.log(`Col gutters (${colGutters.length}):`, colGutters);
  console.log(`Row gutters (${rowGutters.length}):`, rowGutters);
  console.log(`Columns: ${colBounds.length - 1}, Rows: ${rowBounds.length - 1}`);

  if (colBounds.length - 1 !== 8 || rowBounds.length - 1 !== 6) {
    console.warn('Unexpected grid — expected 8×6');
  }

  writeFileSync(
    OUT,
    JSON.stringify({ width: W, height: H, colGutters, rowGutters, colBounds, rowBounds }, null, 2),
  );
}

main();
