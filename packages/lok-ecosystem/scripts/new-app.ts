/** pnpm lok:new-app <name> [--label "Name"] [--no-chat] [--no-errors]: scaffold artifacts/<name>. Never overwrites. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { scaffoldApp } from '../src/scaffold';
import { repoRoot, sdkVersion } from './_files';

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith('--'));
const labelAt = args.indexOf('--label');
if (!name) { console.error('usage: lok:new-app <name> [--label "Display Name"] [--no-chat] [--no-errors]'); process.exit(2); }

const root = repoRoot();
const target = join(root, 'artifacts', name);
if (existsSync(target)) { console.error(`artifacts/${name} already exists; nothing was written`); process.exit(1); }
const files = scaffoldApp({
  name,
  label: labelAt >= 0 ? args[labelAt + 1] : undefined,
  sdkVersion: sdkVersion(root),
  starterCast: readFileSync(join(root, 'packages/lok-chat/examples/minimal-cast/cast.ts'), 'utf8'),
  chat: !args.includes('--no-chat'),
  errorReport: !args.includes('--no-errors'),
});
for (const [path, text] of Object.entries(files)) {
  const file = join(target, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}
console.log(`created artifacts/${name} (${Object.keys(files).length} files). Next: pnpm install, then pnpm --filter @workspace/${name} test`);
