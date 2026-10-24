import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LOW_BATTERY, effectiveFrameRate, savingReason, type PowerFacts } from './powerSaver';

const facts = (over: Partial<PowerFacts> = {}): PowerFacts => ({ batteryLevel: 0.8, charging: false, saveData: false, ...over });

test('Off never saves and On always does', () => {
  assert.equal(savingReason('off', facts({ batteryLevel: 0.01, saveData: true })), null);
  assert.equal(savingReason('on', facts()), 'manual');
});

test('Auto saves on a low battery that is not charging', () => {
  assert.equal(savingReason('auto', facts({ batteryLevel: LOW_BATTERY })), 'battery');
  assert.equal(savingReason('auto', facts({ batteryLevel: 0.05 })), 'battery');
  assert.equal(savingReason('auto', facts({ batteryLevel: 0.21 })), null);
});

test('Auto does not save while charging, and a missing battery reading never counts', () => {
  assert.equal(savingReason('auto', facts({ batteryLevel: 0.05, charging: true })), null);
  assert.equal(savingReason('auto', facts({ batteryLevel: null })), null);
});

test('Auto follows the browser Data Saver', () => {
  assert.equal(savingReason('auto', facts({ saveData: true })), 'dataSaver');
  assert.equal(savingReason('auto', facts({ saveData: true, batteryLevel: 0.1 })), 'battery');
});

test('the saver holds the frame rate down to its cap and never raises it', () => {
  assert.equal(effectiveFrameRate(120, true, 30), 30);
  assert.equal(effectiveFrameRate(60, true, 45), 45);
  assert.equal(effectiveFrameRate(30, true, 60), 30);
  assert.equal(effectiveFrameRate(120, false, 30), 120);
});
