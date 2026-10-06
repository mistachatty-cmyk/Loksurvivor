import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CHARACTERS, CHARACTERS_BY_ID } from '@/game/data/characters';
import { AREAS } from '@/game/data/areas';
import { FORGE_FIVE } from '@/game/data/forgeFive';
import { WEAPONS } from '@/game/data/weapons';
import { createWorld, stepWorld } from '@/game/engine/world';
import { FORGE_FIVE_WEAPON_IDS } from '@/game/render/forgeFiveVfx';

test('five new operators have unique designs and exclusive signature weapon VFX', () => {
  assert.equal(FORGE_FIVE.length, 5);
  assert.equal(new Set(FORGE_FIVE.map((c) => c.id)).size, 5);
  assert.equal(new Set(FORGE_FIVE.map((c) => c.weapon.id)).size, 5);
  assert.equal(new Set(FORGE_FIVE.map((c) => c.rig)).size, 5);
  assert.deepEqual(new Set(FORGE_FIVE.map((c) => c.weapon.id)), new Set(FORGE_FIVE_WEAPON_IDS));
  for (const character of FORGE_FIVE) {
    assert.equal(CHARACTERS_BY_ID[character.id], character);
    assert.ok(CHARACTERS.includes(character));
    assert.ok(character.rig.parts.length >= 10);
    assert.ok(!WEAPONS.some((weapon) => weapon.id === character.weapon.id), 'signature weapon is not general loot');
  }
});

test('each new signature weapon fires its own projectile in a run', () => {
  const area = { ...AREAS[0]!, waves: [], obstacles: [], musicEvents: undefined };
  for (const character of FORGE_FIVE) {
    const world = createWorld(area, character, character.stats, 616);
    world.weapons[0]!.readyAt = 0;
    for (let frame = 0; frame < 45 && world.projectiles.length === 0; frame += 1) {
      stepWorld(world, 1 / 30, { moveX: 0, moveY: 0, ultimate: false });
    }
    assert.ok(world.projectiles.some((shot) => shot.weaponId === character.weapon.id), character.id);
  }
});
