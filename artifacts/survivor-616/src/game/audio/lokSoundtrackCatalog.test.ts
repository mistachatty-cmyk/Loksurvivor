import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * `public/lok-soundtrack.json` is how every other Lok app and the GSix hub
 * find this album (the `lok.playlist/v1` standard). It points at files under
 * `public/music/`, so a rename on either side silently breaks playback on
 * other sites -- these checks fail the suite instead.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const catalog = JSON.parse(readFileSync(path.join(root, 'public/lok-soundtrack.json'), 'utf8'));
const source = readFileSync(path.join(here, 'musicPlayer.tsx'), 'utf8');

test('catalog declares the Lok playlist standard', () => {
  assert.equal(catalog.schema, 'lok.playlist/v1');
  assert.equal(catalog.source.app, 'survivor616');
  assert.ok(catalog.tracks.length >= 1);
});

test('every catalog track has a unique id and an https URL to a file that exists', () => {
  const ids = new Set<string>();
  for (const track of catalog.tracks) {
    assert.ok(!ids.has(track.id), `duplicate id ${track.id}`);
    ids.add(track.id);
    assert.match(track.url, /^https:\/\/survivor\.gsix\.online\/music\/lokifed-take-1\/[^/]+\.m4a$/);
    const file = track.url.split('/music/lokifed-take-1/')[1];
    assert.ok(existsSync(path.join(root, 'public/music/lokifed-take-1', file)), `missing ${file}`);
  }
});

test('catalog matches the in-game album: same ids, titles and unlock counts', () => {
  for (const track of catalog.tracks) {
    assert.ok(source.includes(`id: '${track.id}'`), `${track.id} is not in musicPlayer.tsx`);
    assert.ok(source.includes(`unlockObjectiveCount: ${track.gate.objectives} }`), `${track.id} gate drifted`);
    assert.ok(source.includes(track.title.replace(/'/g, "\\'")) || source.includes(track.title), `${track.title} title drifted`);
  }
});
