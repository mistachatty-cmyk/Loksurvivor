import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { CHANGELOG } from './changelog';
import { buildPublicUpdates, PUBLIC_UPDATES_SCHEMA, serializePublicUpdates } from './publicUpdates';

const here = path.dirname(fileURLToPath(import.meta.url));
const published = path.resolve(here, '../../../public/lok-updates.json');

test('the public updates document carries every patch note, newest first, numbered like the game', () => {
  const doc = buildPublicUpdates();
  assert.equal(doc.schema, PUBLIC_UPDATES_SCHEMA);
  assert.equal(doc.updates.length, CHANGELOG.length);
  assert.equal(doc.updates[0]!.version, CHANGELOG[CHANGELOG.length - 1]!.version);
  assert.equal(doc.updates[doc.updates.length - 1]!.number, 1);
  assert.equal(doc.updates[0]!.number, CHANGELOG.length);
  for (const entry of doc.updates) assert.ok(entry.body.length > 0 && entry.title && entry.date);
});

test('public/lok-updates.json matches the changelog. If this fails, regenerate it', () => {
  const current = readFileSync(published, 'utf8');
  assert.equal(
    current,
    serializePublicUpdates(),
    'public/lok-updates.json is stale. Run: pnpm exec tsx scripts/export-public-updates.ts public/lok-updates.json',
  );
});
