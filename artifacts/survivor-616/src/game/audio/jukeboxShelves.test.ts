import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildShelves, entriesOf, idHash, shelfDiscItem, shelfIndexFor, shortLabel, stepShelf, type ShelfTrack } from './jukeboxShelves';

const lok = (n: number, locked = false): ShelfTrack => ({ id: `lokifed-${n}`, title: `Song ${n}`, source: 'bundled', trackNumber: n, album: 'Lokifed — Take 1', unlockObjectiveCount: n, locked });
const fit = (id: string): ShelfTrack => ({ id, title: `${id} — DJ Misfit`, source: 'bundled', album: 'DJ Misfit — New Fits' });
const mine: ShelfTrack = { id: 'mine', title: 'My file', source: 'local' };

test('songs are grouped into one shelf per album, in catalog order, and local files get no shelf', () => {
  const shelves = buildShelves([lok(2), fit('a'), mine, lok(1), fit('b')]);
  assert.deepEqual(shelves.map((s) => s.title), ['Lokifed — Take 1', 'DJ Misfit — New Fits']);
  assert.deepEqual(shelves[0]!.tracks.map((t) => t.trackNumber), [1, 2]);
  assert.deepEqual(shelves[1]!.tracks.map((t) => t.id), ['a', 'b']);
  assert.equal(buildShelves([mine]).length, 0);
});

test('a bundled song with no album lands on a Soundtrack shelf', () => {
  assert.equal(buildShelves([{ id: 'x', title: 'X', source: 'bundled' }])[0]!.title, 'Soundtrack');
});

test('single-row mode lists every shelf end to end and remembers each song\'s place', () => {
  const entries = entriesOf(buildShelves([lok(1), fit('a'), fit('b')]));
  assert.deepEqual(entries.map((e) => [e.shelfTitle, e.position]), [['Lokifed — Take 1', 0], ['DJ Misfit — New Fits', 0], ['DJ Misfit — New Fits', 1]]);
});

test('the shelf to open on is the one holding the playing song, then the remembered one, then the first', () => {
  const shelves = buildShelves([lok(1), fit('a')]);
  assert.equal(shelfIndexFor(shelves, 'a'), 1);
  assert.equal(shelfIndexFor(shelves, null, shelves[1]!.id), 1);
  assert.equal(shelfIndexFor(shelves, 'gone', 'gone-too'), 0);
});

test('stepping shelves wraps around both ends', () => {
  assert.equal(stepShelf(0, -1, 3), 2);
  assert.equal(stepShelf(2, 1, 3), 0);
  assert.equal(stepShelf(1, 1, 3), 2);
  assert.equal(stepShelf(0, 1, 0), 0);
});

test('Lokifed keeps its hand-made discs, other albums get a stable generated one', () => {
  assert.equal(shelfDiscItem(lok(1), 1, 'Lokifed — Take 1').label, 'Save My Grace');
  const a = shelfDiscItem(fit('newfits-01'), 0, 'DJ Misfit — New Fits');
  const b = shelfDiscItem(fit('newfits-01'), 0, 'DJ Misfit — New Fits');
  assert.deepEqual(a, b);
  assert.ok(a.pattern && a.palette);
  assert.match(a.fine ?? '', /DJ Misfit — New Fits {2}· {2}Track 01/);
  assert.notEqual(idHash('a'), idHash('b'));
});

test('a locked song is a sealed disc whatever album it is on', () => {
  assert.equal(shelfDiscItem(lok(5, true), 5, 'Lokifed — Take 1').label, 'Sealed');
});

test('generated discs never print an artist or licensing claim and never use the retired word', () => {
  const item = shelfDiscItem(fit('newfits-01'), 0, 'DJ Misfit — New Fits');
  assert.ok(!/licen[sc]e|signal/i.test(`${item.label} ${item.fine}`));
  assert.equal(item.label, 'newfits-01');
});

test('short labels cut at the dash and trim long names', () => {
  assert.equal(shortLabel('His Beat — DJ Misfit'), 'His Beat');
  assert.equal(shortLabel('A very long song title indeed', 12), 'A very long…');
});
