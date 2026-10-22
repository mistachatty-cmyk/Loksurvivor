import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ICE_GRIP_RATE, slipVelocity, type SlipState } from './iceSlip';

test('solid ground gives full steering and stores no momentum', () => {
  const actor: SlipState = {};
  assert.deepEqual(slipVelocity(actor, 100, -40, 1 / 60, false), { x: 100, y: -40 });
  assert.equal(actor.slipVx, undefined);
});

test('on ice an actor keeps moving after it stops steering', () => {
  const actor: SlipState = {};
  slipVelocity(actor, 200, 0, 1 / 60, true); // starts at the wanted velocity
  let travelled = 0;
  for (let i = 0; i < 30; i += 1) travelled += slipVelocity(actor, 0, 0, 1 / 60, true).x / 60;
  assert.ok(travelled > 40, `slid ${travelled}px`);
  assert.ok((actor.slipVx ?? 0) > 50, 'still carrying speed half a second later');
});

test('turning on ice is slow compared with the same turn on the ground', () => {
  const ice: SlipState = { slipVx: 200, slipVy: 0 };
  const turned = slipVelocity(ice, 0, 200, 1 / 60, true);
  assert.ok(turned.x > 190, 'barely changed direction in one frame');
  const grip = 1 - Math.exp(-ICE_GRIP_RATE / 60);
  assert.ok(Math.abs(turned.y - 200 * grip) < 1e-9);
});

test('leaving the ice blends back to full grip and then clears the momentum', () => {
  const actor: SlipState = { slipVx: 200, slipVy: 0 };
  let v = { x: 200, y: 0 };
  for (let i = 0; i < 120; i += 1) v = slipVelocity(actor, 0, 0, 1 / 60, false);
  assert.deepEqual(v, { x: 0, y: 0 });
  assert.equal(actor.slipVx, undefined);
});
