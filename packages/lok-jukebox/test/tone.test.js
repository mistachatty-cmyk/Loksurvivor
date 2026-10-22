import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MIN_HZ, OPEN_HZ, TRANSPARENT_TONE, dampenToTone } from '../src/index.js';

test('dampen 0 is fully open with a +4 dB low-end lift', () => {
  assert.deepEqual(dampenToTone(0), { lowpassHz: OPEN_HZ, bassDb: 4 });
});

test('the spec dampen values land where the doc says', () => {
  const l1 = dampenToTone(3.5);
  const l2 = dampenToTone(1.5);
  assert.ok(l1.lowpassHz > 1000 && l1.lowpassHz < 1200, `l1=${l1.lowpassHz}`);
  assert.ok(l2.lowpassHz > 5500 && l2.lowpassHz < 6000, `l2=${l2.lowpassHz}`);
  assert.equal(l1.bassDb, 0);
});

test('more dampen is always more muffled and never below the floor', () => {
  let last = Infinity;
  for (let d = 0; d <= 6; d += 0.25) {
    const { lowpassHz } = dampenToTone(d);
    assert.ok(lowpassHz <= last);
    assert.ok(lowpassHz >= MIN_HZ);
    last = lowpassHz;
  }
  assert.equal(dampenToTone(99).lowpassHz, dampenToTone(6).lowpassHz);
});

test('junk input falls back to the open sound', () => {
  assert.deepEqual(dampenToTone(Number.NaN), { lowpassHz: OPEN_HZ, bassDb: 4 });
});

test('the transparent tone changes nothing audible', () => {
  assert.deepEqual({ ...TRANSPARENT_TONE }, { lowpassHz: OPEN_HZ, bassDb: 0 });
});
