import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  indexAt,
  inkFor,
  offsetOf,
  poseOf,
  releaseTarget,
  rubber,
  springOf,
  springStep,
  targetFor,
  wrapIndex,
  wrapLabel,
} from './disc-cascade-carousel';

// Locks the pure motion and label helpers of the shared Lok disc carousel, so a
// later edit to the component (here or in the ecosystem copy) cannot quietly
// change how a disc line moves or how a label prints.

test('wrapIndex wraps both directions and tolerates an empty list', () => {
  assert.equal(wrapIndex(-1, 12), 11);
  assert.equal(wrapIndex(12, 12), 0);
  assert.equal(wrapIndex(5, 0), 0);
});

test('indexAt clamps when not looping and wraps when looping', () => {
  assert.equal(indexAt(-2.4, 12, false), 0);
  assert.equal(indexAt(14.2, 12, false), 11);
  assert.equal(indexAt(12.4, 12, true), 0);
});

test('offsetOf takes the short way round when looping', () => {
  assert.equal(offsetOf(11, 0, 12, true), -1);
  assert.equal(offsetOf(11, 0, 12, false), 11);
});

test('rubber slows a drag past either end to a third', () => {
  assert.equal(rubber(-3, 12), -1);
  assert.equal(rubber(11 + 3, 12), 12);
  assert.equal(rubber(5, 12), 5);
});

test('releaseTarget never travels more than three slides and respects ends', () => {
  assert.equal(releaseTarget(5, 100, 12, false), 8);
  assert.equal(releaseTarget(10.6, 100, 12, false), 11);
  assert.equal(releaseTarget(0, -100, 12, true), -3);
});

test('targetFor picks the nearest copy of a slide when looping', () => {
  assert.equal(targetFor(0, 11, 12, true), 12);
  assert.equal(targetFor(40, 3, 12, false), 11);
});

test('springStep settles on its target without blowing up on a long frame', () => {
  const { omega, slide } = springOf(0.22, 0.9);
  let x = 0;
  let v = 0;
  for (let i = 0; i < 240; i++) [x, v] = springStep(x, v, 1, omega, slide, 1 / 60);
  assert.ok(Math.abs(x - 1) < 1e-3, `x=${x}`);
  const [bigX] = springStep(0, 0, 1, omega, slide, 0.5);
  assert.ok(Number.isFinite(bigX));
});

test('poseOf puts the chosen disc at the origin and hides far discs', () => {
  const cfg = { spacing: 1.02, rise: 0.24, depth: 0.42, yaw: 22, fan: -10, roll: 110 };
  const centre = poseOf(0, 0, cfg);
  // `y` is `-dx * rise`, which is -0 at the origin; compare by value, not Object.is.
  assert.ok(centre.x === 0);
  assert.ok(centre.y === 0);
  assert.equal(centre.hidden, false);
  assert.equal(poseOf(-5, -5, cfg).hidden, true);
  assert.equal(poseOf(3, 3, cfg).hidden, true);
});

test('inkFor prints white on dark labels and near-black on light ones', () => {
  assert.equal(inkFor('#141414'), '#ffffff');
  assert.equal(inkFor('#f2e3c6'), '#111111');
  assert.equal(inkFor('not-a-colour'), '#ffffff');
});

test('wrapLabel wraps greedily and gives an over-long word its own line', () => {
  assert.deepEqual(wrapLabel('Save My Grace', 11), ['Save My', 'Grace']);
  assert.deepEqual(wrapLabel('Extraordinarily long', 5), ['Extraordinarily', 'long']);
  assert.deepEqual(wrapLabel('   ', 11), []);
});
