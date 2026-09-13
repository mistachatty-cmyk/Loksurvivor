import assert from 'node:assert/strict';
import test from 'node:test';

import { escalatingWaves, palette, squadWave } from './authoring';

test('palette() fills accentBright/skin/glow defaults but keeps explicit overrides', () => {
  const withDefaults = palette({ ink: '#000', body: '#111', bodyDark: '#222', accent: '#333' });
  assert.equal(withDefaults.accentBright, '#333');
  assert.equal(withDefaults.skin, '#111');
  assert.equal(withDefaults.glow, '#333');

  const withOverrides = palette({ ink: '#000', body: '#111', bodyDark: '#222', accent: '#333', accentBright: '#fff', skin: '#abc', glow: '#def' });
  assert.equal(withOverrides.accentBright, '#fff');
  assert.equal(withOverrides.skin, '#abc');
  assert.equal(withOverrides.glow, '#def');
});

test('escalatingWaves produces the right step count and rate progression per cycle', () => {
  const waves = escalatingWaves({ enemyId: 'packet-wraith', baseRatePerSec: 0.4, matchLengthSec: 240, cycleSec: 120, steps: 4 });
  assert.equal(waves.length, 8); // 2 cycles x 4 steps
  const round = (n: number) => Math.round(n * 100) / 100;
  const firstCycle = waves.slice(0, 4);
  assert.deepEqual(firstCycle.map((w) => round(w.ratePerSec)), [0.4, 0.8, 1.2, 1.6]);
  assert.deepEqual(firstCycle.map((w) => w.fromSec), [0, 30, 60, 90]);
  assert.deepEqual(firstCycle.map((w) => w.toSec), [30, 60, 90, 120]);
  // Resets at the start of the second cycle rather than continuing to climb.
  const secondCycle = waves.slice(4, 8);
  assert.deepEqual(secondCycle.map((w) => round(w.ratePerSec)), [0.4, 0.8, 1.2, 1.6]);
  assert.deepEqual(secondCycle.map((w) => w.fromSec), [120, 150, 180, 210]);
  assert.equal(waves.every((w) => w.enemyId === 'packet-wraith'), true);
});

test('escalatingWaves clamps the final cycle to matchLengthSec', () => {
  const waves = escalatingWaves({ enemyId: 'packet-wraith', baseRatePerSec: 1, matchLengthSec: 45, cycleSec: 120, steps: 4 });
  // Only 2 steps (0-30, 30-45) fit before matchLengthSec cuts it off.
  assert.equal(waves.length, 2);
  assert.equal(waves[1]!.toSec, 45);
});

test('escalatingWaves covers the full 600s match with 5 complete cycles at the documented default', () => {
  const waves = escalatingWaves({ enemyId: 'packet-wraith', baseRatePerSec: 0.4, matchLengthSec: 600 });
  assert.equal(waves.length, 20); // 5 cycles x 4 steps
  assert.equal(waves.at(-1)!.toSec, 600);
});

test('squadWave still spawns the whole roster as one lead + group (regression guard alongside escalatingWaves)', () => {
  const wave = squadWave({ fromSec: 0, toSec: 10, factionId: 'null-sector', ratePerSec: 1 });
  assert.equal(wave.enemyId, 'packet-wraith');
  assert.deepEqual(wave.group, ['firewall-brute', 'null-spitter', 'corrupted-lookout', 'drift-shard']);
});
