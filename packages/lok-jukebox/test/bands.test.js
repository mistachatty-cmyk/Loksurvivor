import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FALL_MS, IDLE_BANDS, gradeFrom, groupBands, smoothBands } from '../src/index.js';

test('groupBands folds five bands into bass, mid and treble', () => {
  const g = groupBands({ sub: 0.2, bass: 0.6, lowMid: 0.4, mid: 0.2, high: 0.9 });
  assert.equal(g.bass, 0.6);
  assert.ok(Math.abs(g.mid - 0.3) < 1e-9);
  assert.equal(g.treble, 0.9);
  assert.deepEqual(groupBands(undefined), { bass: 0, mid: 0, treble: 0 });
});

test('smoothing rises faster than it falls', () => {
  const up = smoothBands({ bass: 0, mid: 0, treble: 0 }, { bass: 1, mid: 0, treble: 0 }, 100).bass;
  const down = 1 - smoothBands({ bass: 1, mid: 0, treble: 0 }, { bass: 0, mid: 0, treble: 0 }, 100).bass;
  assert.ok(up > down);
});

test('a stalled frame cannot jump the grade', () => {
  const stalled = smoothBands(IDLE_BANDS, { bass: 1, mid: 1, treble: 1 }, 60_000).bass;
  const capped = smoothBands(IDLE_BANDS, { bass: 1, mid: 1, treble: 1 }, 250).bass;
  assert.equal(stalled, capped);
  assert.ok(stalled < 0.3);
  assert.ok(FALL_MS > 1000);
});

test('grade values stay inside their documented bounds for any input', () => {
  for (const v of [0, 0.5, 1, 7, -3, Number.NaN]) {
    const g = gradeFrom({ sub: v, bass: v, lowMid: v, mid: v, high: v }, v);
    assert.ok(g.glow >= 0.2 && g.glow <= 1, `glow ${g.glow}`);
    assert.ok(g.hue >= -20 && g.hue <= 20, `hue ${g.hue}`);
    assert.ok(g.vignette >= 0.45 && g.vignette <= 0.8, `vignette ${g.vignette}`);
    assert.ok(g.grain >= 0.02 && g.grain <= 0.1, `grain ${g.grain}`);
  }
});
