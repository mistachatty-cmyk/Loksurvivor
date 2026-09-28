import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyRuntimePerformance, millionHordeActorCap } from './performanceProfile';

test('modern phones use the iPhone 17 Pro-class runtime tier', () => {
  assert.equal(classifyRuntimePerformance({ mobile: true, hardwareConcurrency: 6 }), 'high-mobile');
  assert.equal(classifyRuntimePerformance({ mobile: true, hardwareConcurrency: 8, deviceMemoryGb: 6 }), 'high-mobile');
});

test('older phones receive progressively smaller bounded actor budgets', () => {
  const older = classifyRuntimePerformance({ mobile: true, hardwareConcurrency: 2, deviceMemoryGb: 2 });
  assert.equal(older, 'constrained-mobile');
  assert.ok(millionHordeActorCap(older, 'performance') < millionHordeActorCap('high-mobile', 'high'));
});

test('Million Horde actor caps never approach its represented population', () => {
  assert.equal(millionHordeActorCap('high-mobile', 'high'), 720);
  assert.equal(millionHordeActorCap('desktop', 'high'), 1000);
  assert.ok(millionHordeActorCap('constrained-mobile', 'performance') >= 100);
});
