import assert from 'node:assert/strict';
import { test } from 'node:test';

import { THEATER_LEVELS, levelAt, nextChangeIn } from '../src/index.js';

test('the three levels match the spec table', () => {
  assert.deepEqual(
    THEATER_LEVELS.map((l) => [l.level, l.uiOpacity, l.dampen]),
    [
      [1, 1, 3.5],
      [2, 0.35, 1.5],
      [3, 0, 0],
    ],
  );
});

test('levels switch at 4 s and 24 s after a touch', () => {
  assert.equal(levelAt(0).level, 1);
  assert.equal(levelAt(3999).level, 1);
  assert.equal(levelAt(4000).level, 2);
  assert.equal(levelAt(23999).level, 2);
  assert.equal(levelAt(24000).level, 3);
  assert.equal(levelAt(10 * 60 * 1000).level, 3);
});

test('paused stays at level 1 no matter how long it has been', () => {
  assert.equal(levelAt(60_000, { paused: true }).level, 1);
  assert.equal(nextChangeIn(60_000, { paused: true }), null);
});

test('theater mix off never dampens but still fades the UI', () => {
  const l3 = levelAt(30_000, { theaterMix: false });
  assert.equal(l3.level, 3);
  assert.equal(l3.uiOpacity, 0);
  assert.equal(l3.dampen, 0);
  assert.equal(levelAt(0, { theaterMix: false }).dampen, 0);
  assert.equal(levelAt(0, { theaterMix: true }).dampen, 3.5);
});

test('nextChangeIn counts down to each boundary and ends at level 3', () => {
  assert.equal(nextChangeIn(0), 4000);
  assert.equal(nextChangeIn(1000), 3000);
  assert.equal(nextChangeIn(4000), 20000);
  assert.equal(nextChangeIn(10_000), 14000);
  assert.equal(nextChangeIn(24000), null);
});

test('bad input is treated as a fresh touch', () => {
  assert.equal(levelAt(-5).level, 1);
  assert.equal(levelAt(Number.NaN).level, 1);
  assert.equal(nextChangeIn(Number.NaN), 4000);
});

test('custom durations are honoured', () => {
  assert.equal(levelAt(1500, { activeMs: 1000, dimMs: 1000 }).level, 2);
  assert.equal(levelAt(2000, { activeMs: 1000, dimMs: 1000 }).level, 3);
});
