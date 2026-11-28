/** pnpm lok:check: every app's lok.universe.json must pass checkManifest. Exits 1 on any problem (used in CI). */
import { appStatus } from '../src/status';
import { readManifests, repoRoot } from './_files';

const apps = readManifests(repoRoot()).map(appStatus);
let failed = 0;
for (const a of apps) {
  if (a.problems.length === 0) { console.log(`ok   ${a.path}`); continue; }
  failed += 1;
  console.error(`FAIL ${a.path}`);
  for (const p of a.problems) console.error(`  - ${p}`);
}
if (apps.length === 0) { console.error('no apps found under artifacts/'); process.exit(1); }
process.exit(failed > 0 ? 1 : 0);
