#!/usr/bin/env node
/**
 * Renders a saved run JSON without remembering Remotion's CLI flags.
 *
 *   node scripts/render-run.mjs ./runs/2026-09-11.json --wide
 *
 * Validates against the schema first, because a render that fails twelve
 * seconds in over a missing field wastes a minute of encode time.
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, resolve } from 'node:path';

const [, , input, ...flags] = process.argv;
if (!input) {
  console.error('Usage: node scripts/render-run.mjs <run.json> [--wide]');
  process.exit(1);
}

const { runRecapSchema } = await import('../src/schema.ts').catch(() => ({}));
const raw = JSON.parse(readFileSync(resolve(input), 'utf8'));
if (runRecapSchema) {
  const parsed = runRecapSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('Run JSON does not match the recap schema:');
    console.error(parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n'));
    process.exit(1);
  }
}

const wide = flags.includes('--wide');
const composition = wide ? 'RunRecapWide' : 'RunRecapVertical';
const name = basename(input).replace(/\.json$/, '');
mkdirSync('out', { recursive: true });
const out = `out/${name}${wide ? '-wide' : ''}.mp4`;

const result = spawnSync(
  'npx',
  ['remotion', 'render', 'src/index.ts', composition, out, `--props=${resolve(input)}`],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
