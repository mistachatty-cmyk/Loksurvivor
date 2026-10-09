import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPetExp, getExpForLevel, petMaxLevel, runPowerScale } from './petExpCurve';

test('runPowerScale climbs linearly for non-starters from a tiny level-1 bonus, capped at level 50', () => {
  assert.ok(Math.abs(runPowerScale(1, false) - 1.009) < 1e-9);
  assert.ok(Math.abs(runPowerScale(50, false) - 1.45) < 1e-9);
  assert.equal(runPowerScale(60, false), runPowerScale(50, false));
});

test('runPowerScale tapers starters on to +70% by level 99 and caps past it', () => {
  assert.ok(Math.abs(runPowerScale(50, true) - 1.45) < 1e-9);
  assert.ok(Math.abs(runPowerScale(99, true) - 1.70) < 1e-9);
  assert.equal(runPowerScale(150, true), runPowerScale(99, true));
});

test('existing level curve is untouched by the new export', () => {
  assert.equal(getExpForLevel(1), 50);
  assert.equal(petMaxLevel(), 50);
  assert.equal(petMaxLevel(true), 99);
  assert.deepEqual(applyPetExp({ level: 1, exp: 0 }, 0), { level: 1, exp: 0, levelsGained: 0, capped: false });
});
