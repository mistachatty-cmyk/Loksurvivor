import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyPulled, decideSync, mergePlaylists, parseSnapshot, syncablePlaylists } from './playlistSync';

const bundled = new Set(['a', 'b', 'c']);

test('only custom playlists and shipped songs leave the device', () => {
  const out = syncablePlaylists(
    [
      { id: 'album', name: 'Album', trackIds: ['a'], builtIn: true },
      { id: 'p1', name: '  Night drive  ', trackIds: ['a', 'my-own-file', 'c'] },
    ],
    bundled,
  );
  assert.deepEqual(out, [{ id: 'p1', name: 'Night drive', trackIds: ['a', 'c'] }]);
});

test('malformed cloud data is ignored', () => {
  assert.equal(parseSnapshot(null, bundled), null);
  assert.equal(parseSnapshot({ savedAt: 'x', playlists: [] }, bundled), null);
  const parsed = parseSnapshot({ savedAt: 5, playlists: [{ id: 'p', name: 'N', trackIds: ['a', 7, 'zzz'] }, 3, { id: 1 }] }, bundled);
  assert.deepEqual(parsed, { savedAt: 5, playlists: [{ id: 'p', name: 'N', trackIds: ['a'] }] });
});

test('the newest edit wins, and an unchanged set does nothing', () => {
  const mine = [{ id: 'p', name: 'Mine', trackIds: ['a'] }];
  const theirs = { savedAt: 200, playlists: [{ id: 'p', name: 'Theirs', trackIds: ['b'] }] };
  assert.equal(decideSync(mine, 100, theirs, false).action, 'pull');
  assert.equal(decideSync(mine, 300, theirs, false).action, 'push');
  assert.equal(decideSync(theirs.playlists, 300, theirs, false).action, 'none');
  assert.equal(decideSync([], 0, null, false).action, 'none');
  assert.equal(decideSync(mine, 100, null, true).action, 'push');
});

test('a device that never synced merges instead of overwriting', () => {
  const mine = [{ id: 'p1', name: 'Mine', trackIds: ['a'] }];
  const theirs = { savedAt: 999, playlists: [{ id: 'p2', name: 'Theirs', trackIds: ['b'] }] };
  const decision = decideSync(mine, 1, theirs, true);
  assert.equal(decision.action, 'merge');
  if (decision.action === 'merge') assert.deepEqual(decision.playlists.map((p) => p.id).sort(), ['p1', 'p2']);
});

test('merging keeps the longer song list for a shared playlist', () => {
  const merged = mergePlaylists([{ id: 'p', name: 'L', trackIds: ['a', 'b'] }], [{ id: 'p', name: 'C', trackIds: ['a'] }]);
  assert.deepEqual(merged, [{ id: 'p', name: 'C', trackIds: ['a', 'b'] }]);
});

test('pulling keeps songs from the player\'s own files on the same playlist', () => {
  const out = applyPulled(
    [{ id: 'p', name: 'Old', trackIds: ['a', 'local-1'] }, { id: 'album', name: 'Album', trackIds: ['a'], builtIn: true }],
    [{ id: 'p', name: 'New', trackIds: ['b'] }],
    bundled,
  );
  assert.deepEqual(out, [{ id: 'p', name: 'New', trackIds: ['b', 'local-1'] }]);
});
