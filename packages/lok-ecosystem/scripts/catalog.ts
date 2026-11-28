/** pnpm lok:catalog [--check]: write docs/lok-plugins.json from the catalog, or with --check fail if it is stale. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { catalogJson } from '../src/catalog';
import { repoRoot } from './_files';

const file = join(repoRoot(), 'docs/lok-plugins.json');
const next = catalogJson();
if (process.argv.includes('--check')) {
  if (!existsSync(file) || readFileSync(file, 'utf8') !== next) { console.error('docs/lok-plugins.json is stale: run pnpm --filter @lok/ecosystem lok:catalog'); process.exit(1); }
  console.log('docs/lok-plugins.json is up to date');
} else { writeFileSync(file, next); console.log('wrote docs/lok-plugins.json'); }
