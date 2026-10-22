import assert from 'node:assert/strict';
import test from 'node:test';

import { getArea } from '@/game/data/areas';
import { getCharacter } from '@/game/data/characters';
import { applyUpgrade, createWorld, levelUpPreviewSeed, previewUpgradeChoices, rollUpgradeChoices } from './world';

const makeWorld = () => {
  const character = getCharacter('shade');
  return createWorld(getArea('back-alley'), character, character.stats);
};
const ids = (list: Array<{ id: string }>) => list.map((entry) => entry.id);

test('the preview is stable and never spends the run\'s random stream', () => {
  const world = makeWorld();
  let draws = 0;
  const original = world.rng;
  world.rng = () => {
    draws += 1;
    return original();
  };
  const first = previewUpgradeChoices(world);
  const second = previewUpgradeChoices(world);
  assert.equal(draws, 0);
  assert.equal(first.length, 3);
  assert.deepEqual(ids(first), ids(second));
});

test('the options previewed before the level are the options offered when it lands', () => {
  const world = makeWorld();
  const before = ids(previewUpgradeChoices(world));
  world.level += 1;
  world.pendingLevelUps += 1;
  assert.deepEqual(ids(previewUpgradeChoices(world)), before);
});

test('taking an option changes what is previewed next', () => {
  const world = makeWorld();
  const seedBefore = levelUpPreviewSeed(world);
  const first = previewUpgradeChoices(world);
  applyUpgrade(world, first[0]!);
  assert.notEqual(levelUpPreviewSeed(world), seedBefore);
});

test('a reroll still draws from the real random stream', () => {
  const world = makeWorld();
  let draws = 0;
  const original = world.rng;
  world.rng = () => {
    draws += 1;
    return original();
  };
  rollUpgradeChoices(world, 3);
  assert.ok(draws >= 3);
});
