/**
 * Slice hwatu sprite sheet — tries 4×12 (1 month/row) layout.
 */
import { mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { getCard } from '@gostop/engine';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SHEET = join(ROOT, 'public/assets/hwatu-sheet.png');
const OUT = join(ROOT, 'public/assets/cards-test');

const COLS = 4;
const ROWS = 12;

function idToGrid(id: number): { row: number; col: number } {
  const monthIndex = Math.floor(id / 4);
  const slot = id % 4;
  return { row: monthIndex, col: slot };
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const meta = await sharp(SHEET).metadata();
  const cellW = Math.floor(meta.width! / COLS);
  const cellH = Math.floor(meta.height! / ROWS);
  const inset = 2;

  for (let id = 0; id < 48; id++) {
    const { row, col } = idToGrid(id);
    await sharp(SHEET)
      .extract({
        left: col * cellW + inset,
        top: row * cellH + inset,
        width: cellW - inset * 2,
        height: cellH - inset * 2,
      })
      .png()
      .toFile(join(OUT, `${id}.png`));
    const c = getCard(id);
    console.log(
      `id ${id} m${c.month} ${c.category} → r${row}c${col}`,
    );
  }
}

main();
