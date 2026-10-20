import assert from 'node:assert/strict';
import test from 'node:test';

import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { WEAPONS_BY_ID } from '@/game/data/weapons';
import { arcTetherTargets, buildResult, createWorld, interactWithMap, isWeaponUnlockedForLoot, nearbyMapInteractable, stepWorld, type EnemyActor } from '@/game/engine/world';
import { createInitialMeta, reducer } from '@/game/state/metaStore';

test('Floodline set pieces change state and finds reach the run result', () => {
  const area = AREAS.find((candidate) => candidate.id === 'floodline-breach')!;
  const character = CHARACTERS[0]!;
  const world = createWorld(area, character, character.stats, 616);
  const byId = (id: string) => area.mapInteractables!.find((entry) => entry.id === id)!;
  const use = (id: string) => { const entry = byId(id); world.player.x = entry.x; world.player.y = entry.y; assert.equal(nearbyMapInteractable(world)?.id, id); assert.equal(interactWithMap(world), true); };
  assert.equal(nearbyMapInteractable(world), null);
  use('flood-relay-west');
  use('flood-relay-north');
  assert.equal(world.breakables.find((prop) => prop.artAssetId === 'barricade' && prop.x === 0 && prop.y === -490)?.broken, true);
  use('flood-plate');
  use('flood-coil');
  assert.ok(world.weapons.some((weapon) => weapon.def.id === 'catenary-harpoon'));
  assert.deepEqual(new Set(buildResult(world).mapFindIds), new Set(['breach-616-plate', 'transit-coil-found']));
  world.outcome = 'defeated';
  const defeat = buildResult(world);
  assert.deepEqual(new Set(defeat.mapFindIds), new Set(['breach-616-plate', 'transit-coil-found']));
  const saved = reducer({ meta: createInitialMeta(), lastRun: null }, { type: 'completeRun', result: defeat });
  assert.ok(saved.meta.discoveryIds.includes('transit-coil-found'));
  assert.ok(saved.meta.ownedUiThemeIds.includes('breach-616'));
});

test('Catenary Harpoon combat data is independent of its visual chain', () => {
  const weapon = WEAPONS_BY_ID['catenary-harpoon']!;
  assert.equal(weapon.kind, 'arc-tether');
  assert.equal(weapon.damage, 32);
  assert.equal(weapon.cooldownMs, 1350);
  assert.equal(weapon.lootUnlockDiscoveryId, 'transit-coil-found');
  assert.equal(isWeaponUnlockedForLoot(weapon, [], []), false);
  assert.equal(isWeaponUnlockedForLoot(weapon, [], ['transit-coil-found']), true);
  const enemies = [
    { uid: 1, x: 120, y: 0, dying: false },
    { uid: 2, x: 260, y: 0, dying: false },
    { uid: 3, x: 430, y: 0, dying: false },
    { uid: 4, x: 900, y: 0, dying: false },
  ] as EnemyActor[];
  assert.deepEqual(arcTetherTargets(enemies, { x: 0, y: 0 }, 390).map((hit) => hit.target.uid), [1, 2, 3]);
  assert.deepEqual(arcTetherTargets(enemies, { x: 0, y: 0 }, 100), []);
});

test('both new arenas clear at their authored finite durations', () => {
  for (const id of ['floodline-breach', 'glassroot-annex']) {
    const area = AREAS.find((candidate) => candidate.id === id)!;
    const character = CHARACTERS[0]!;
    const world = createWorld(area, character, character.stats, 616);
    world.time = area.durationSec - 0.01;
    world.now = world.time * 1000;
    stepWorld(world, 1 / 30, { moveX: 0, moveY: 0, ultimate: false });
    assert.equal(world.outcome, 'cleared', id);
  }
});
