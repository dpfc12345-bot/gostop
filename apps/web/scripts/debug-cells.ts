import { mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHEET = join(__dirname, '../public/assets/hwatu-sheet.png');
const GRID = join(__dirname, '../public/assets/sheet-grid.json');
const OUT = join(__dirname, '../public/assets/debug-cells');

async function main() {
  mkdirSync(OUT, { recursive: true });
  const { colBounds, rowBounds } = JSON.parse(readFileSync(GRID, 'utf8'));
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 8; col++) {
      const inset = 1;
      await sharp(SHEET)
        .extract({
          left: colBounds[col] + inset,
          top: rowBounds[row] + inset,
          width: colBounds[col + 1] - colBounds[col] - inset * 2,
          height: rowBounds[row + 1] - rowBounds[row] - inset * 2,
        })
        .png()
        .toFile(join(OUT, `r${row}_c${col}.png`));
    }
  }
}

main();
