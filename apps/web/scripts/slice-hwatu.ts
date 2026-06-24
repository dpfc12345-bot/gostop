/**
 * Slice hwatu sprite sheet into 48 normalized card PNGs.
 * Crops to the red card border so white gutters never bleed through.
 *
 * Run: pnpm --filter @gostop/web assets:cards
 */
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { engineIdToSheetGrid } from '../src/lib/sheet-layout.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SHEET = join(ROOT, 'public/assets/hwatu-sheet.png');
const GRID = join(ROOT, 'public/assets/sheet-grid.json');
const OUT = join(ROOT, 'public/assets/cards');

const OUT_W = 100;
const OUT_H = 140;

function idToGrid(id: number): { row: number; col: number } {
  return engineIdToSheetGrid(id);
}

interface SheetGrid {
  colBounds: number[];
  rowBounds: number[];
}

function isRed(r: number, g: number, b: number): boolean {
  return r > 145 && g < 105 && b < 105 && r - Math.max(g, b) > 55;
}

/** Tight crop around the red outer border of a card cell. */
async function cropToRedBorder(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;

  let minX = W;
  let minY = H;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (isRed(data[i]!, data[i + 1]!, data[i + 2]!)) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX <= minX || maxY <= minY) {
    return input;
  }

  const shrink = 1;
  const left = Math.max(0, minX + shrink);
  const top = Math.max(0, minY + shrink);
  const width = Math.min(W - left, maxX - minX + 1 - shrink * 2);
  const height = Math.min(H - top, maxY - minY + 1 - shrink * 2);

  if (width < 4 || height < 4) {
    return input;
  }

  return sharp(input)
    .extract({ left, top, width, height })
    .flatten({ background: { r: 185, g: 28, b: 28 } })
    .png()
    .toBuffer();
}

async function main(): Promise<void> {
  if (!existsSync(SHEET)) {
    console.error('Missing sprite sheet:', SHEET);
    process.exit(1);
  }
  if (!existsSync(GRID)) {
    console.error('Missing grid — run: pnpm exec tsx scripts/detect-grid.ts');
    process.exit(1);
  }

  mkdirSync(OUT, { recursive: true });

  const grid = JSON.parse(readFileSync(GRID, 'utf8')) as SheetGrid;
  const { colBounds, rowBounds } = grid;

  console.log(`Grid ${colBounds.length - 1}×${rowBounds.length - 1} → ${OUT_W}×${OUT_H}`);

  for (let id = 0; id < 48; id++) {
    const { row, col } = idToGrid(id);
    const inset = 2;
    const left = colBounds[col]! + inset;
    const top = rowBounds[row]! + inset;
    const width = colBounds[col + 1]! - colBounds[col]! - inset * 2;
    const height = rowBounds[row + 1]! - rowBounds[row]! - inset * 2;

    const extracted = await sharp(SHEET).extract({ left, top, width, height }).png().toBuffer();
    const cropped = await cropToRedBorder(extracted);

    await sharp(cropped)
      .resize(OUT_W, OUT_H, { fit: 'fill' })
      .png()
      .toFile(join(OUT, `${id}.png`));
  }

  console.log(`Wrote 48 cards → ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
