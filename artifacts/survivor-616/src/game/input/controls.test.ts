import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CONTROL_ACTIONS, DEFAULT_CONTROLS, RESERVED_KEYS, actionForKey, dashDirection, normalizeControls,
  padMove, rebindButton, rebindKey, stickVector,
} from './controls';

test('defaults give every action its own key and its own button', () => {
  assert.equal(new Set(Object.values(DEFAULT_CONTROLS.keys)).size, CONTROL_ACTIONS.length);
  assert.equal(new Set(Object.values(DEFAULT_CONTROLS.gamepad.buttons)).size, CONTROL_ACTIONS.length);
  assert.ok(CONTROL_ACTIONS.every((a) => !RESERVED_KEYS.includes(DEFAULT_CONTROLS.keys[a])));
  assert.equal(actionForKey(DEFAULT_CONTROLS, 'Shift'), 'dash');
});

test('rebinding swaps with the current owner and refuses movement keys', () => {
  const next = rebindKey(DEFAULT_CONTROLS, 'dash', 'f');
  assert.equal(next.keys.dash, 'f');
  assert.equal(next.keys.interact, 'shift', 'interact takes the dash key so nothing is unbound');
  assert.equal(rebindKey(DEFAULT_CONTROLS, 'dash', 'W'), DEFAULT_CONTROLS);
  assert.equal(rebindKey(DEFAULT_CONTROLS, 'dash', ''), DEFAULT_CONTROLS);
  const pad = rebindButton(DEFAULT_CONTROLS, 'dash', 0);
  assert.equal(pad.gamepad.buttons.dash, 0);
  assert.equal(pad.gamepad.buttons.interact, 1);
  assert.equal(rebindButton(DEFAULT_CONTROLS, 'dash', 99), DEFAULT_CONTROLS);
});

test('bad saved data falls back to defaults field by field', () => {
  assert.deepEqual(normalizeControls(null), DEFAULT_CONTROLS);
  assert.deepEqual(normalizeControls('nonsense'), DEFAULT_CONTROLS);
  const messy = normalizeControls({
    keys: { dash: 'w', ultimate: 'q', interact: 'q', pause: 5 },
    gamepad: { deadzone: 9, buttons: { dash: -1 } },
    touch: { dashButton: 'yes' },
  });
  assert.equal(messy.keys.dash, DEFAULT_CONTROLS.keys.dash, 'a movement key is refused');
  assert.equal(messy.keys.ultimate, 'q');
  assert.equal(new Set(Object.values(messy.keys)).size, CONTROL_ACTIONS.length, 'never two actions on one key');
  assert.equal(messy.gamepad.deadzone, 0.6);
  assert.equal(messy.gamepad.buttons.dash, DEFAULT_CONTROLS.gamepad.buttons.dash);
  assert.equal(messy.touch.dashButton, true);
});

test('the stick deadzone ignores drift and ramps up smoothly', () => {
  assert.deepEqual(stickVector(0.1, 0.1, 0.2), { x: 0, y: 0 });
  const half = stickVector(0.6, 0, 0.2);
  assert.ok(half.x > 0 && half.x < 0.6, 'rescaled below the raw value');
  const full = stickVector(1, 0, 0.2);
  assert.ok(Math.abs(full.x - 1) < 1e-9);
  const diag = stickVector(1, 1, 0.2);
  assert.ok(Math.hypot(diag.x, diag.y) <= 1 + 1e-9);
  assert.deepEqual(stickVector(NaN, 0, 0.2), { x: 0, y: 0 });
});

test('the d-pad overrides the stick and diagonals are normalised', () => {
  const none = () => false;
  assert.deepEqual(padMove([0, 0], none, 0.2), { x: 0, y: 0 });
  const up = padMove([1, 0], (b) => b === 12, 0.2);
  assert.deepEqual(up, { x: 0, y: -1 });
  const diag = padMove([0, 0], (b) => b === 12 || b === 15, 0.2);
  assert.ok(Math.abs(Math.hypot(diag.x, diag.y) - 1) < 1e-9);
});

test('a dash always has a direction', () => {
  assert.deepEqual(dashDirection({ x: 0, y: 1 }, null, 1), { x: 0, y: 1 });
  assert.deepEqual(dashDirection({ x: 0, y: 0 }, { x: -1, y: 0 }, 1), { x: -1, y: 0 });
  assert.deepEqual(dashDirection({ x: 0, y: 0 }, null, -1), { x: -1, y: 0 });
  assert.deepEqual(dashDirection({ x: 0.05, y: 0 }, null, 1), { x: 1, y: 0 });
});
