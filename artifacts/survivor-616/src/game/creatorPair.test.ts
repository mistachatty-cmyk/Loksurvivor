import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AREAS } from './data/areas';
import { CHARACTERS, CHARACTERS_BY_ID } from './data/characters';
import { CREATOR_PAIR_OPERATORS } from './data/creatorPair';
import { WEAPONS } from './data/weapons';
import { createWorld, stepWorld } from './engine/world';

test('the pair are real roster entries with their own look, weapon and ultimate', () => {
  assert.equal(CREATOR_PAIR_OPERATORS.length, 2);
  assert.notEqual(CREATOR_PAIR_OPERATORS[0]!.rig, CREATOR_PAIR_OPERATORS[1]!.rig);
  assert.notEqual(CREATOR_PAIR_OPERATORS[0]!.weapon.id, CREATOR_PAIR_OPERATORS[1]!.weapon.id);
  for (const character of CREATOR_PAIR_OPERATORS) {
    assert.equal(CHARACTERS_BY_ID[character.id], character);
    assert.ok(CHARACTERS.includes(character));
    assert.ok(character.rig.parts.length >= 12, `${character.id} has a detailed rig`);
    assert.ok(!WEAPONS.some((weapon) => weapon.id === character.weapon.id), 'signature weapon is not general loot');
    assert.equal(CHARACTERS.filter((other) => other.id === character.id).length, 1, 'ids are unique');
  }
});

test('new copy never uses the banned word', () => {
  const text = JSON.stringify(CREATOR_PAIR_OPERATORS.map((c) => ({ ...c, rig: undefined }))).toLowerCase();
  assert.ok(!text.includes('signal'));
});

test('Spoke Queen circles herself with wheels and Jackhammer Jean sends shock waves', () => {
  const area = { ...AREAS[0]!, waves: [], obstacles: [], musicEvents: undefined };
  const queen = CHARACTERS_BY_ID['spoke-queen']!;
  const world = createWorld(area, queen, queen.stats, 616);
  for (let frame = 0; frame < 20; frame += 1) stepWorld(world, 1 / 30, { moveX: 0, moveY: 0, ultimate: false });
  assert.ok(world.orbiters.length >= 3, 'three wheels orbit');
  assert.ok(world.orbiters.every((orb) => orb.weaponId === 'spoke-halo'));

  const jean = CHARACTERS_BY_ID['jackhammer-jean']!;
  const quake = createWorld(area, jean, jean.stats, 616);
  quake.weapons[0]!.readyAt = 0;
  for (let frame = 0; frame < 45 && !quake.effects.some((effect) => effect.weaponId === 'jean-quake'); frame += 1) {
    stepWorld(quake, 1 / 30, { moveX: 0, moveY: 0, ultimate: false });
  }
  assert.ok(quake.effects.some((effect) => effect.weaponId === 'jean-quake'), 'the quake fires');
});
