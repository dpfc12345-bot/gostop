/**
 * Detect card bounding boxes by scanning red borders in each grid cell.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHEET = join(__dirname, '../public/assets/hwatu-sheet.png');
const OUT = join(__dirname, '../public/assets/card-bounds.json');

const COLS = 8;
const ROWS = 6;

function isRed(r: number, g: number, b: number): boolean {
  return r > 150 && g < 100 && b < 100 && r - Math.max(g, b) > 60;
}

function idToGrid(id: number): { row: number; col: number } {
  const monthIndex = Math.floor(id / 4);
  const slot = id % 4;
  return {
    row: Math.floor(monthIndex / 2),
    col: (monthIndex % 2) * 4 + slot,
  };
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function findRedBounds(
  data: Buffer,
  W: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Rect | null {
  let minX = x1;
  let minY = y1;
  let maxX = x0;
  let maxY = y0;

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * 4;
      if (isRed(data[i]!, data[i + 1]!, data[i + 2]!)) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function main(): Promise<void> {
  const img = sharp(SHEET);
  const meta = await img.metadata();
  const W = meta.width!;
  const H = meta.height!;
  const { data } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const colStarts = Array.from({ length: COLS }, (_, i) => Math.floor((i * W) / COLS));
  const colEnds = Array.from({ length: COLS }, (_, i) => Math.floor(((i + 1) * W) / COLS));
  const rowStarts = Array.from({ length: ROWS }, (_, i) => Math.floor((i * H) / ROWS));
  const rowEnds = Array.from({ length: ROWS }, (_, i) => Math.floor(((i + 1) * H) / ROWS));

  const bounds: Record<string, Rect> = {};

  for (let id = 0; id < 48; id++) {
    const { row, col } = idToGrid(id);
    const padX = 4;
    const padY = 4;
    const x0 = Math.max(0, colStarts[col]! - padX);
    const x1 = Math.min(W, colEnds[col]! + padX);
    const y0 = Math.max(0, rowStarts[row]! - padY);
    const y1 = Math.min(H, rowEnds[row]! + padY);

    const rect = findRedBounds(data, W, x0, y0, x1, y1);
    if (!rect) throw new Error(`No red border found for id ${id}`);
    bounds[String(id)] = rect;
  }

  mkdirSync(join(__dirname, '../public/assets'), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ sheet: { width: W, height: H }, bounds }, null, 2));

  const widths = Object.values(bounds).map((b) => b.width);
  const heights = Object.values(bounds).map((b) => b.height);
  console.log(`Sheet ${W}×${H}`);
  console.log(`Card widths: min=${Math.min(...widths)} max=${Math.max(...widths)} avg=${(widths.reduce((a, b) => a + b, 0) / widths.length).toFixed(1)}`);
  console.log(`Card heights: min=${Math.min(...heights)} max=${Math.max(...heights)} avg=${(heights.reduce((a, b) => a + b, 0) / heights.length).toFixed(1)}`);
  console.log(`Wrote ${OUT}`);
}

main();
