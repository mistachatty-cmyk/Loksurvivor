import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MAX_SPIN_SPEED, angleAround, coast, isTap, releaseSpeed, turnBetween } from './discSpin';

test('angleAround measures clockwise from the right', () => {
  assert.equal(Math.round(angleAround(0, 0, 10, 0)), 0);
  assert.equal(Math.round(angleAround(0, 0, 0, 10)), 90);
  assert.equal(Math.round(angleAround(0, 0, -10, 0)), 180);
});

test('turnBetween takes the short way round', () => {
  assert.equal(turnBetween(170, -170), 20);
  assert.equal(turnBetween(-170, 170), -20);
  assert.equal(turnBetween(10, 40), 30);
});

test('a slow release is zero and a fast one is capped', () => {
  assert.equal(releaseSpeed([]), 0);
  assert.equal(releaseSpeed([{ t: 0, angle: 0 }, { t: 4, angle: 1 }]), 0);
  assert.equal(releaseSpeed([{ t: 0, angle: 0 }, { t: 50, angle: 500 }]), MAX_SPIN_SPEED);
  const steady = releaseSpeed([{ t: 0, angle: 0 }, { t: 50, angle: 10 }, { t: 100, angle: 20 }]);
  assert.ok(Math.abs(steady - 200) < 1);
});

test('only the last 120 ms of the drag count toward the release', () => {
  const speed = releaseSpeed([{ t: 0, angle: 0 }, { t: 400, angle: 900 }, { t: 450, angle: 900 }, { t: 500, angle: 900 }]);
  assert.equal(speed, 0);
});

test('a coasting disc slows down and comes to rest', () => {
  let state = { angle: 0, speed: 900 };
  let steps = 0;
  while (state.speed !== 0 && steps < 2000) {
    const before = Math.abs(state.speed);
    state = coast(state.angle, state.speed, 16);
    assert.ok(Math.abs(state.speed) <= before);
    steps += 1;
  }
  assert.equal(state.speed, 0);
  assert.ok(state.angle > 100, 'it turned a fair way before stopping');
  assert.ok(steps < 600, 'it should not coast for ever');
});

test('a coasting step keeps its direction and ignores a long frame hiccup', () => {
  assert.ok(coast(0, -400, 16).angle < 0);
  assert.ok(Math.abs(coast(0, 400, 5000).angle) < 30);
});

test('a short, still press is a tap', () => {
  assert.equal(isTap(2, 120), true);
  assert.equal(isTap(30, 120), false);
  assert.equal(isTap(2, 900), false);
});
