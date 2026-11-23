/**
 * Writes the full asset catalog for the game: every character, enemy, ally, area, weapon, pet, icon,
 * sound cue, track and picture, plus the renderer modules that draw them.
 *
 *   pnpm exec tsx scripts/export-asset-catalog.ts ../../docs/ASSETS.md
 *   pnpm exec tsx scripts/export-asset-catalog.ts --check ../../docs/ASSETS.md   exit 1 if stale
 *
 * Almost everything is drawn in code (procedural rigs, Canvas2D, Lok glyph paths), so the catalog reads
 * the live registries instead of listing image files. `src/game/data/assetCatalog.test.ts` fails when
 * the published file is out of date.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { buildAssetCatalog } from '../src/game/data/assetCatalog';

const md = buildAssetCatalog();
if (process.argv[2] === '--check') {
  if (readFileSync(process.argv[3] ?? '', 'utf8') !== md) {
    console.error('docs/ASSETS.md is stale: run  pnpm exec tsx scripts/export-asset-catalog.ts ../../docs/ASSETS.md');
    process.exit(1);
  }
  console.log('Asset catalog is up to date.');
} else {
  writeFileSync(process.argv[2] ?? 'ASSETS.md', md);
  console.log(`asset catalog -> ${process.argv[2]}`);
}
