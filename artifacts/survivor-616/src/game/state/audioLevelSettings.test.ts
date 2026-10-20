import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseVolumePercent } from './audioLevelSettings';

test('a missing or blank stored volume keeps the original full level', () => {
  assert.equal(parseVolumePercent(null), 100);
  assert.equal(parseVolumePercent(undefined), 100);
  assert.equal(parseVolumePercent(''), 100);
  assert.equal(parseVolumePercent('   '), 100);
});

test('a stored volume that is not a number falls back to full level', () => {
  assert.equal(parseVolumePercent('loud'), 100);
  assert.equal(parseVolumePercent('NaN'), 100);
});

test('stored volumes are clamped to 0-100 and rounded to whole percent', () => {
  assert.equal(parseVolumePercent('-20'), 0);
  assert.equal(parseVolumePercent('250'), 100);
  assert.equal(parseVolumePercent('42.6'), 43);
  assert.equal(parseVolumePercent('0'), 0);
});
