/** pnpm lok:status [--write]: print the ecosystem status, or write docs/ECOSYSTEM_STATUS.md with --write. */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { appStatus, renderStatus } from '../src/status';
import { readManifests, repoRoot, sdkVersion } from './_files';

const root = repoRoot();
const text = renderStatus(readManifests(root).map(appStatus), sdkVersion(root));
if (process.argv.includes('--write')) { writeFileSync(join(root, 'docs/ECOSYSTEM_STATUS.md'), text); console.log('wrote docs/ECOSYSTEM_STATUS.md'); }
else console.log(text);
