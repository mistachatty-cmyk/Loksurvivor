import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LOKIFED_DISC_STYLES, albumTracks, discItemFor, sealedProgress, startingDisc, type DiscTrack } from './jukeboxDiscs';

const bundled = (n: number, locked = false): DiscTrack => ({
  id: `lokifed-${n}`,
  title: `Track ${n}`,
  source: 'bundled',
  trackNumber: n,
  unlockObjectiveCount: n,
  locked,
});

test('every Lokifed track number 0 to 11 has a disc style', () => {
  for (let n = 0; n <= 11; n++) assert.ok(LOKIFED_DISC_STYLES[n], `missing style for track ${n}`);
});

test('disc labels and rims never print an artist or licensing claim', () => {
  for (let n = 0; n <= 11; n++) {
    const item = discItemFor(bundled(n));
    assert.ok(!/cante|licen[sc]e/i.test(`${item.label} ${item.fine} ${item.title}`));
  }
});

test('albumTracks keeps only bundled album tracks, in track order', () => {
  const tracks: DiscTrack[] = [
    bundled(3),
    { id: 'mine', title: 'My file', source: 'local' },
    bundled(1),
    bundled(2),
  ];
  assert.deepEqual(
    albumTracks(tracks).map((t) => t.trackNumber),
    [1, 2, 3],
  );
});

test('a locked track becomes a sealed disc that says how to open it', () => {
  const item = discItemFor(bundled(5, true));
  assert.equal(item.label, 'Sealed');
  assert.match(item.fine ?? '', /Finish 5 objectives/);
});

test('an open track keeps its own style and short label', () => {
  const item = discItemFor(bundled(1));
  assert.equal(item.label, 'Save My Grace');
  assert.equal(item.pattern, 'rings');
});

test('startingDisc prefers the playing disc, then the first unlocked, then zero', () => {
  const discs = [bundled(0, true), bundled(1), bundled(2)];
  assert.equal(startingDisc(discs, 'lokifed-2'), 2);
  assert.equal(startingDisc(discs, null), 1);
  assert.equal(startingDisc([bundled(0, true)], null), 0);
});

test('a sealed disc is drawn as a see-through blueprint', () => {
  const item = discItemFor(bundled(5, true));
  assert.equal(item.pattern, 'blueprint');
  assert.equal(item.palette?.[0], 'rgba(0,0,0,0)');
});

test('sealedProgress says how many objectives are left, never negative', () => {
  assert.deepEqual(sealedProgress(bundled(5, true), 2), { need: 5, have: 2, left: 3 });
  assert.deepEqual(sealedProgress(bundled(5, true), 9), { need: 5, have: 5, left: 0 });
  assert.deepEqual(sealedProgress(bundled(5, true), -1), { need: 5, have: 0, left: 5 });
});
