import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildAssetCatalog } from './assetCatalog';

const here = path.dirname(fileURLToPath(import.meta.url));
const published = path.resolve(here, '../../../../../docs/ASSETS.md');

test('the asset catalog lists the rescue art and every glyph, and the published doc is current', () => {
  const md = buildAssetCatalog();
  assert.ok(md.includes('rescueArt.ts') && md.includes('objectiveArt.ts'));
  assert.ok(md.includes('`crown`') && md.includes('`lock`'));
  assert.equal(readFileSync(published, 'utf8'), md, 'docs/ASSETS.md is stale: run pnpm exec tsx scripts/export-asset-catalog.ts ../../docs/ASSETS.md');
});
