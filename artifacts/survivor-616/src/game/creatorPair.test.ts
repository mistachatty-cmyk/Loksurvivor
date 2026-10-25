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

test('leveling the signature weapon unlocks its path: more wheels, an aftershock and a slam', () => {
  const area = { ...AREAS[0]!, waves: [], obstacles: [], musicEvents: undefined };
  const queen = CHARACTERS_BY_ID['spoke-queen']!;
  const world = createWorld(area, queen, queen.stats, 616);
  world.weapons[0]!.level = 8;
  for (let frame = 0; frame < 5; frame += 1) stepWorld(world, 1 / 30, { moveX: 0, moveY: 0, ultimate: false });
  assert.equal(world.weapons[0]!.count, 5, 'Quick-Release and Mass Ride add two wheels');
  assert.equal(world.orbiters.length, 5);
  assert.ok(world.alerts.some((alert) => alert.text.includes('Mass Ride')), 'the player is told');

  const jean = CHARACTERS_BY_ID['jackhammer-jean']!;
  const quake = createWorld(area, jean, jean.stats, 616);
  quake.weapons[0]!.level = 8;
  quake.weapons[0]!.readyAt = 0;
  let rings = 0;
  for (let frame = 0; frame < 600 && (quake.weapons[0]!.casts ?? 0) < 3; frame += 1) {
    stepWorld(quake, 1 / 30, { moveX: 0, moveY: 0, ultimate: false });
    rings = Math.max(rings, quake.effects.filter((effect) => effect.kind === 'ring' && effect.weaponId === 'jean-quake').length);
  }
  assert.equal(quake.weapons[0]!.casts, 3);
  assert.equal(quake.weapons[0]!.count, 3, 'Rebar adds a third wave');
  assert.ok(rings >= 1, 'the third swing slams a ring');
});
