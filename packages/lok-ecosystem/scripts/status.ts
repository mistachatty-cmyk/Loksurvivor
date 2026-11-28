/** pnpm lok:status [--write | --check]: print the ecosystem status, write docs/ECOSYSTEM_STATUS.md, or fail if it is stale. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { appStatus, renderStatus } from '../src/status';
import { readManifests, repoRoot, sdkVersion } from './_files';

const root = repoRoot();
const text = renderStatus(readManifests(root).map(appStatus), sdkVersion(root));
const file = join(root, 'docs/ECOSYSTEM_STATUS.md');
if (process.argv.includes('--write')) { writeFileSync(file, text); console.log('wrote docs/ECOSYSTEM_STATUS.md'); }
else if (process.argv.includes('--check')) {
  if (!existsSync(file) || readFileSync(file, 'utf8') !== text) { console.error('docs/ECOSYSTEM_STATUS.md is stale: run pnpm --filter @lok/ecosystem lok:status --write'); process.exit(1); }
  console.log('docs/ECOSYSTEM_STATUS.md is up to date');
}
else console.log(text);
