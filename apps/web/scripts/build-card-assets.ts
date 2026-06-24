import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

execSync('pnpm exec tsx scripts/detect-grid.ts', { stdio: 'inherit', cwd: ROOT });
execSync('pnpm exec tsx scripts/slice-hwatu.ts', { stdio: 'inherit', cwd: ROOT });
