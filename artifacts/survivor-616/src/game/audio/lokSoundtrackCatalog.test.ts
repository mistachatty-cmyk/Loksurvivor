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
import { ECOSYSTEM_RELEASES, ecosystemTracks } from './ecosystemCatalog';
const bundled = ecosystemTracks(ECOSYSTEM_RELEASES);

test('catalog declares the Lok playlist standard', () => {
  assert.equal(catalog.schema, 'lok.playlist/v1');
  assert.equal(catalog.source.app, 'survivor616');
  assert.ok(catalog.tracks.length >= 1);
});

test('catalog says which game the songs are from and where to play it', () => {
  assert.equal(catalog.source.name, '616 Survivor');
  assert.match(catalog.source.url, /^https:\/\//);
  for (const track of catalog.tracks) assert.ok(track.gate.unit, `${track.id} should say what its objectives are called`);
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

test('legacy catalog preserves the actual generated ids, titles and gates', () => {
  for (const track of catalog.tracks) {
    const found = bundled.find((item) => item.id === track.id);
    assert.ok(found, track.id);
    assert.equal(found.title, track.title);
    assert.equal(found.unlockObjectiveCount, track.gate.objectives);
  }
});

test('all shared Survivor releases resolve to actual bundled audio files', () => {
  const shared = JSON.parse(readFileSync(path.join(root, 'public/lok-music-catalog.json'), 'utf8'));
  assert.deepEqual(shared.playlists.map((p: {id: string}) => p.id), ECOSYSTEM_RELEASES.map((p) => p.id));
  for (const release of shared.playlists) for (const track of release.tracks) {
    if (release.source.app !== 'survivor616') continue;
    assert.ok(existsSync(path.join(root, 'public', new URL(track.url).pathname)), track.url);
  }
  const forgettable = shared.playlists.find((p: {title: string}) => p.title === 'Forgettable Data');
  assert.equal(forgettable.kind, 'soundtrack');
  assert.equal(forgettable.tracks.length, 12);
});
