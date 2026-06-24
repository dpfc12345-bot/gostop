/** Print E2E seed catalog for manual browser sessions. Run: pnpm exec tsx src/print-seeds.ts */
import { getE2ESeedCatalog, getManualBrowserSeeds } from '@gostop/engine/testing';

const catalog = getE2ESeedCatalog();
console.log('\n=== Playable seeds (automated E2E) ===');
console.log(catalog.playableSeeds.join('\n'));

console.log('\n=== Special-rule seeds (byTag) ===');
for (const [tag, seed] of Object.entries(catalog.byTag)) {
  console.log(`${tag}: ${seed}`);
}

console.log('\n=== Manual browser matrix ===');
for (const row of getManualBrowserSeeds()) {
  console.log(`${row.seed}\t${row.purpose}`);
}
