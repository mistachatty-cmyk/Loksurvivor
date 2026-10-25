import assert from 'node:assert/strict';
import test from 'node:test';

import { applyPreset, clampDb, EQ_LIMIT_DB, EQ_PRESETS, FLAT_EQ, isFlatEq, nextPreset, normalizeEq, presetFor } from './musicEq';

test('bands clamp to the limit and junk becomes flat', () => {
  assert.equal(clampDb(99), EQ_LIMIT_DB);
  assert.equal(clampDb(-99), -EQ_LIMIT_DB);
  assert.equal(clampDb('loud'), 0);
  assert.equal(clampDb(NaN), 0);
  assert.deepEqual(normalizeEq(null), FLAT_EQ);
  assert.deepEqual(normalizeEq([1, 2]), FLAT_EQ);
  assert.deepEqual(normalizeEq({ bassDb: 40, midDb: 'x', trebleDb: -3.4, evenVolume: 'yes', mono: true }), { bassDb: 12, midDb: 0, trebleDb: -3, evenVolume: false, mono: true });
});

test('presets round-trip and hand-tuned bands match none', () => {
  for (const preset of EQ_PRESETS) assert.equal(presetFor(applyPreset(FLAT_EQ, preset.id)), preset.id);
  assert.equal(presetFor({ bassDb: 1, midDb: 2, trebleDb: 3 }), null);
  assert.equal(applyPreset({ ...FLAT_EQ, mono: true, evenVolume: true }, 'warm').mono, true, 'a preset only moves the bands');
});

test('cycling walks the list, wraps, and restarts from the top after hand tuning', () => {
  assert.equal(nextPreset(FLAT_EQ), 'bass-boost');
  const last = EQ_PRESETS[EQ_PRESETS.length - 1]!;
  assert.equal(nextPreset(last), 'flat');
  assert.equal(nextPreset({ bassDb: 1, midDb: 1, trebleDb: 1 }), 'flat');
});

test('flat means no bands moved and both switches off', () => {
  assert.equal(isFlatEq(FLAT_EQ), true);
  assert.equal(isFlatEq({ ...FLAT_EQ, mono: true }), false);
  assert.equal(isFlatEq({ ...FLAT_EQ, bassDb: 2 }), false);
});
