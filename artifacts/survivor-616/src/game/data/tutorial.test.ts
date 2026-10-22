import assert from 'node:assert/strict';
import { test } from 'node:test';

import { nextApplicableStep, TUTORIAL_STEPS, type TutorialSnapshot } from './tutorial';

const base: TutorialSnapshot = { distance: 0, kills: 0, level: 1, xp: 0, dashed: false, hasDash: true, hasPet: true };

test('steps run in teaching order and every id is unique', () => {
  assert.deepEqual(TUTORIAL_STEPS.map((step) => step.id), ['move', 'fight', 'gems', 'pet', 'dash', 'level', 'survive']);
  assert.equal(new Set(TUTORIAL_STEPS.map((step) => step.id)).size, TUTORIAL_STEPS.length);
});

test('steps that do not apply are skipped', () => {
  assert.equal(TUTORIAL_STEPS[nextApplicableStep(3, base)]!.id, 'pet');
  assert.equal(TUTORIAL_STEPS[nextApplicableStep(3, { ...base, hasPet: false })]!.id, 'dash');
  assert.equal(TUTORIAL_STEPS[nextApplicableStep(4, { ...base, hasDash: false })]!.id, 'level');
  assert.equal(nextApplicableStep(TUTORIAL_STEPS.length, base), TUTORIAL_STEPS.length);
});

test('each step is finished by its own action', () => {
  const step = (id: string) => TUTORIAL_STEPS.find((candidate) => candidate.id === id)!;
  assert.equal(step('move').done(base, 5000), false);
  assert.equal(step('move').done({ ...base, distance: 200 }, 0), true);
  assert.equal(step('fight').done({ ...base, kills: 2 }, 9999), false);
  assert.equal(step('fight').done({ ...base, kills: 3 }, 0), true);
  assert.equal(step('gems').done({ ...base, xp: 4 }, 0), true);
  assert.equal(step('dash').done({ ...base, dashed: true }, 0), true);
  assert.equal(step('level').done({ ...base, level: 2 }, 1000), false);
  assert.equal(step('level').done({ ...base, level: 2 }, 4000), true);
});
