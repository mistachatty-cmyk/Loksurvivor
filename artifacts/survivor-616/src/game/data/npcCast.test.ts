import assert from 'node:assert/strict';
import test from 'node:test';

import { LORE_CHRONICLES } from './lore';
import { JERAMY_FROGSTER, JEREMEY_FROGSTER, LUVITNOT_KEEPER } from './npcCast';
import { createInitialMeta, normalizeMeta } from '@/game/state/metaStore';
import { grpdArmoryLocation } from './grpdArmory';
import { HUB_ROOMS } from './progression';

test('new room hosts have distinct complete sprite rigs and saved lore', () => {
  const cast = [JEREMEY_FROGSTER, JERAMY_FROGSTER, LUVITNOT_KEEPER];
  assert.equal(new Set(cast.map((member) => member.id)).size, 3);
  const loreIds = new Set(LORE_CHRONICLES.map((entry) => entry.id));
  for (const member of cast) {
    assert.ok(loreIds.has(member.loreId));
    assert.ok(member.rig.parts.length > 20);
    assert.ok(member.rig.anims.idle.frames.length > 0);
    assert.ok(member.rig.anims.walk.frames.length > 0);
    assert.ok(member.rig.parts.every((part) => part.y + part.h <= member.rig.pixelHeight));
  }
  assert.notDeepEqual(JEREMEY_FROGSTER.rig.parts, JERAMY_FROGSTER.rig.parts);
  assert.notDeepEqual(JERAMY_FROGSTER.palette, LUVITNOT_KEEPER.palette);
});

test('Armory anchor defaults to the station and preserves a hideout move', () => {
  const initial = createInitialMeta();
  assert.equal(initial.grpdArmoryAnchor, 'station');
  assert.equal(normalizeMeta({ ...initial, grpdArmoryAnchor: 'hideout' }).grpdArmoryAnchor, 'hideout');
  assert.equal(normalizeMeta({ ...initial, grpdArmoryAnchor: undefined }).grpdArmoryAnchor, 'station');
});

test('the Armory is reachable before the GRPD Station is found', () => {
  const station = HUB_ROOMS.find((room) => room.id === 'grpd-station');
  assert.equal(station?.kind, 'travel');
  assert.notEqual(station?.unlock.kind, 'default');
  // Fresh save: the station is still locked, so the entrance must be in the hideout.
  assert.equal(grpdArmoryLocation(createInitialMeta().grpdArmoryAnchor, false), 'hideout');
  // Once found, the saved anchor decides again.
  assert.equal(grpdArmoryLocation('station', true), 'station');
  assert.equal(grpdArmoryLocation('hideout', true), 'hideout');
});
