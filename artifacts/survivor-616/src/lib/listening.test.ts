import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addSeconds, emptyListening, formatListening, recentIds, recordPlay, toggleFavorite, totalPlays, totalSeconds } from './listening';

test('plays and seconds add up per song', () => {
  let s = emptyListening();
  s = addSeconds(s, 'a', 30);
  s = recordPlay(s, 'a', 1000);
  s = addSeconds(s, 'a', 10);
  s = recordPlay(s, 'a', 2000);
  assert.deepEqual(s.stats.a, { plays: 2, seconds: 40, last: 2000 });
  assert.equal(totalPlays(s), 2);
  assert.equal(totalSeconds(s), 40);
});

test('recent songs are newest first and only include songs actually played', () => {
  let s = emptyListening();
  s = addSeconds(s, 'skipped', 5);
  s = recordPlay(s, 'old', 100);
  s = recordPlay(s, 'new', 300);
  s = recordPlay(s, 'mid', 200);
  assert.deepEqual(recentIds(s), ['new', 'mid', 'old']);
  assert.deepEqual(recentIds(s, 2), ['new', 'mid']);
});

test('hearts toggle on and off and do not touch the history', () => {
  let s = recordPlay(emptyListening(), 'a', 1);
  s = toggleFavorite(s, 'a');
  assert.deepEqual(s.favorites, ['a']);
  s = toggleFavorite(s, 'a');
  assert.deepEqual(s.favorites, []);
  assert.equal(s.stats.a!.plays, 1);
});

test('history is capped so the save stays small, keeping the newest', () => {
  let s = emptyListening();
  for (let i = 0; i < 450; i += 1) s = recordPlay(s, `t${i}`, i + 1);
  assert.equal(Object.keys(s.stats).length, 400);
  assert.ok(s.stats.t449);
  assert.equal(s.stats.t0, undefined);
});

test('listening time reads in plain units', () => {
  assert.equal(formatListening(0), '0s');
  assert.equal(formatListening(45), '45s');
  assert.equal(formatListening(600), '10m');
  assert.equal(formatListening(4800), '1h 20m');
});
