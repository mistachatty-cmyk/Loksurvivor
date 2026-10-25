import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CREATOR_PAIR_OPERATORS } from '@/game/data/creatorPair';
import type { RunWeapon } from '@/game/types';

import { claimMilestones, everyNth, milestoneEffects, reachedMilestones, surgeActive } from './milestones';

const spoke = CREATOR_PAIR_OPERATORS.find((c) => c.id === 'spoke-queen')!.weapon;
const quake = CREATOR_PAIR_OPERATORS.find((c) => c.id === 'jackhammer-jean')!.weapon;
const run = (def = spoke, level = 1): RunWeapon => ({ def, level, count: def.count ?? 1, readyAt: 0 });

test('each milestone arrives at its level, pays out once and adds its pieces', () => {
  const w = run();
  assert.deepEqual(claimMilestones(w), [], 'nothing before level 2');
  w.level = 2;
  assert.deepEqual(claimMilestones(w).map((m) => m.name), ['Quick-Release']);
  assert.equal(w.count, 4);
  assert.deepEqual(claimMilestones(w), [], 'a milestone is not granted twice');
  w.level = 8;
  assert.deepEqual(claimMilestones(w).map((m) => m.name), ['Brake Dust', 'Wheelie', 'Mass Ride']);
  assert.equal(w.count, 5, 'only Quick-Release and Mass Ride add a wheel');
});

test('later milestones replace earlier effects instead of stacking them', () => {
  assert.equal(milestoneEffects(spoke, 1).hitBurst, undefined);
  assert.equal(milestoneEffects(spoke, 4).hitBurst?.radius, 46);
  assert.equal(milestoneEffects(spoke, 8).hitBurst?.radius, 64);
  assert.equal(milestoneEffects(spoke, 5).surge, undefined);
  assert.equal(milestoneEffects(spoke, 6).surge?.everyMs, 6000);
  assert.equal(milestoneEffects(spoke, 8).surge?.everyMs, 4500);
  assert.equal(milestoneEffects(quake, 3).echo, undefined);
  assert.ok(milestoneEffects(quake, 4).echo);
  assert.equal(milestoneEffects(quake, 6).every?.slam, undefined);
  assert.ok(milestoneEffects(quake, 8).every?.slam);
  assert.deepEqual(milestoneEffects({}, 8), {});
});

test('a weapon without a path is untouched', () => {
  const plain: RunWeapon = { def: { ...spoke, milestones: undefined }, level: 8, count: 3, readyAt: 0 };
  assert.deepEqual(claimMilestones(plain), []);
  assert.equal(plain.count, 3);
});

test('the surge is a pure function of run time and every-Nth counts the cast being fired', () => {
  const surge = milestoneEffects(spoke, 6).surge;
  assert.equal(surgeActive(surge, 0), true);
  assert.equal(surgeActive(surge, 1399), true);
  assert.equal(surgeActive(surge, 1400), false);
  assert.equal(surgeActive(surge, 6000), true);
  assert.equal(surgeActive(undefined, 0), false);
  const every = milestoneEffects(quake, 6).every;
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((n) => everyNth(every, n)), [false, false, true, false, false, true]);
  assert.equal(everyNth(undefined, 3), false);
});

test('both new operators have a path of four steps that ends at level 8', () => {
  for (const weapon of [spoke, quake]) {
    const levels = reachedMilestones(weapon, 8).map((m) => m.level);
    assert.deepEqual(levels, [2, 4, 6, 8]);
  }
});
