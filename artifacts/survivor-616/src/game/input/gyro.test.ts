/**
 * Tilt mapping tests.
 *
 * The whole point of keeping `mapTilt` a pure function of angles is that the
 * part most likely to be wrong -- which way is right when the phone is sideways
 * -- can be checked here in milliseconds, instead of only by picking up a
 * device and guessing.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  gravityFromEuler,
  mapTilt,
  orientationRotation,
  type TiltOrigin,
} from './gyro';

/** Flat on a table: the pose the tests tilt away from. */
const FLAT: TiltOrigin = { gx: 0, gy: 0 };

/** Enough tilt to clear the 4-degree deadzone comfortably. */
const TILT = 15;

function map(beta: number, gamma: number, angle: number, origin: TiltOrigin = FLAT) {
  return mapTilt(beta, gamma, origin, angle, 1, false);
}

/* --- rotation table ---------------------------------------------------- */

test('screen rotation uses exact quarter turns', () => {
  // Fuzz here would bleed one axis into the other, which reads as slow drift.
  assert.deepEqual(orientationRotation(0), { cos: 1, sin: 0 });
  assert.deepEqual(orientationRotation(90), { cos: 0, sin: 1 });
  assert.deepEqual(orientationRotation(180), { cos: -1, sin: 0 });
  assert.deepEqual(orientationRotation(270), { cos: 0, sin: -1 });
});

test('screen rotation normalises negative and out-of-range angles', () => {
  // iOS reports -90 for one landscape; the spec API reports 270.
  assert.deepEqual(orientationRotation(-90), orientationRotation(270));
  assert.deepEqual(orientationRotation(360), orientationRotation(0));
  assert.deepEqual(orientationRotation(450), orientationRotation(90));
});

/* --- gravity ------------------------------------------------------------ */

test('gravity is continuous through the landscape hold', () => {
  // gamma is reported over -90..90, and landscape sits at that limit. Sampling
  // across it must not jump -- a discontinuity here is the bug that made tilt
  // unusable sideways.
  let previous = gravityFromEuler(0, -90).gx;
  for (let gamma = -89; gamma <= -80; gamma += 1) {
    const current = gravityFromEuler(0, gamma).gx;
    assert.ok(
      Math.abs(current - previous) < 0.05,
      `gravity jumped between gamma ${gamma - 1} and ${gamma}`,
    );
    previous = current;
  }
});

test('gravity ignores compass heading by construction', () => {
  // alpha is not a parameter at all: which way the player faces is not a tilt.
  assert.equal(gravityFromEuler.length, 2);
});

/* --- portrait ----------------------------------------------------------- */

test('portrait maps tilt the way it always did', () => {
  assert.ok(map(0, TILT, 0).x > 0, 'right edge down moves right');
  assert.ok(map(0, -TILT, 0).x < 0, 'left edge down moves left');
  assert.ok(map(TILT, 0, 0).y > 0, 'leaning back moves down');
  assert.ok(map(-TILT, 0, 0).y < 0, 'leaning forward moves up');
});

/* --- landscape ---------------------------------------------------------- */

test('landscape steers along the screen, not the device', () => {
  // Rotated 90 degrees, the device's front-back axis now points along the
  // screen's left-right axis. This is the case that was broken.
  const rolled = map(TILT, 0, 90);
  assert.ok(rolled.x > 0, 'device front-back drives screen left-right at 90');
  assert.ok(Math.abs(rolled.y) < 0.01, 'and does not bleed into screen up-down');

  const other = map(TILT, 0, 270);
  assert.ok(other.x < 0, 'the opposite landscape steers the opposite way');
});

test('the two landscape orientations are mirror images', () => {
  const left = map(TILT, 0, 90);
  const right = map(TILT, 0, 270);
  assert.ok(Math.abs(left.x + right.x) < 1e-9, 'x is mirrored');
  assert.ok(Math.abs(left.y + right.y) < 1e-9, 'y is mirrored');
});

test('upside-down portrait inverts both axes', () => {
  const upright = map(TILT, TILT, 0);
  const inverted = map(TILT, TILT, 180);
  assert.ok(Math.abs(upright.x + inverted.x) < 1e-9);
  assert.ok(Math.abs(upright.y + inverted.y) < 1e-9);
});

test('every orientation gives the same deflection for the same physical tilt', () => {
  // Rotating the phone must not change how far it has to be tilted to move.
  const magnitudes = [0, 90, 180, 270].map((angle) => {
    const { x, y } = map(TILT, 0, angle);
    return Math.hypot(x, y);
  });
  for (const magnitude of magnitudes) {
    assert.ok(Math.abs(magnitude - magnitudes[0]!) < 1e-9, 'deflection is orientation-independent');
  }
});

/* --- curve and calibration ---------------------------------------------- */

test('a small tilt inside the deadzone is treated as holding still', () => {
  const { x, y } = map(2, 2, 0);
  assert.equal(x, 0);
  assert.equal(y, 0);
});

test('deflection is clamped at full tilt rather than overshooting', () => {
  const { x } = map(0, 80, 0);
  assert.ok(x <= 1 && x > 0.99, `expected a clamped full deflection, got ${x}`);
});

test('a calibrated neutral means an odd holding pose still reads as centred', () => {
  // Playing lying down: the device is nowhere near flat, but the pose it was
  // calibrated in must still be the origin.
  const origin = gravityFromEuler(55, 20);
  const { x, y } = map(55, 20, 0, origin);
  assert.equal(x, 0);
  assert.equal(y, 0);
});

test('calibration holds in landscape too', () => {
  const origin = gravityFromEuler(0, -88);
  const centred = map(0, -88, 90, origin);
  assert.equal(centred.x, 0);
  assert.equal(centred.y, 0);

  // And tilting away from that pose still registers.
  assert.ok(Math.abs(map(TILT, -88, 90, origin).x) > 0, 'tilt from a landscape neutral moves');
});

test('sensitivity changes how far the device must tilt', () => {
  const gentle = mapTilt(0, 10, FLAT, 0, 0.5, false).x;
  const twitchy = mapTilt(0, 10, FLAT, 0, 2, false).x;
  assert.ok(twitchy > gentle, 'higher sensitivity deflects further for the same tilt');
});

test('invert Y flips only the forward axis', () => {
  const normal = mapTilt(TILT, TILT, FLAT, 0, 1, false);
  const inverted = mapTilt(TILT, TILT, FLAT, 0, 1, true);
  assert.equal(inverted.x, normal.x, 'left-right is untouched');
  assert.ok(Math.abs(inverted.y + normal.y) < 1e-9, 'forward-back is mirrored');
});
