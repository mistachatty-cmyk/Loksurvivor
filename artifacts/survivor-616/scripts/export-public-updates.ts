/**
 * Writes the game's patch notes as the public `lok.public-updates` document.
 *
 *   pnpm exec tsx scripts/export-public-updates.ts public/lok-updates.json
 *   pnpm exec tsx scripts/export-public-updates.ts --check public/lok-updates.json   exit 1 if stale
 *
 * The GSix hub reads the published file (https://survivor.gsix.online/lok-updates.json)
 * for gsix.online/games/survivor616. Convention for every LOK game:
 * Lok-EcoSystsem/LokToken EcoSystem/LOK_PLATFORMS.md.
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { serializePublicUpdates } from '../src/game/data/publicUpdates';

const json = serializePublicUpdates();

if (process.argv[2] === '--check') {
  const current = readFileSync(process.argv[3] ?? '', 'utf8');
  if (current !== json) {
    console.error('Public updates are stale: run  pnpm exec tsx scripts/export-public-updates.ts public/lok-updates.json');
    process.exit(1);
  }
  console.log('Public updates are up to date.');
} else {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: export-public-updates.ts <file>  |  --check <file>');
    process.exit(1);
  }
  writeFileSync(file, json);
  console.log(`${JSON.parse(json).updates.length} updates -> ${file}`);
}
