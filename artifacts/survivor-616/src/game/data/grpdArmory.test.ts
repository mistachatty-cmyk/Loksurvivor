import assert from 'node:assert/strict';
import test from 'node:test';

import { AREAS } from './areas';
import { CHARACTERS } from './characters';
import { GRPD_BLUEPRINTS, GRPD_PLAYABLE_WEAPON_IDS, grpdAvailableSeals, grpdEarnedSeals, grpdNextTierCost, grpdOfferWeight } from './grpdArmory';
import { WEAPONS_BY_ID } from './weapons';
import { claimLootPrize, createWorld, rollUpgradeChoices } from '@/game/engine/world';
import { createInitialMeta, normalizeMeta } from '@/game/state/metaStore';

test('GRPD archive keeps thirty unique designs and only completed prototypes can enter the loot pool', () => {
  assert.equal(GRPD_BLUEPRINTS.length, 30);
  assert.equal(new Set(GRPD_BLUEPRINTS.map((entry) => entry.id)).size, 30);
  assert.equal(GRPD_PLAYABLE_WEAPON_IDS.size, 3);
  for (const id of GRPD_PLAYABLE_WEAPON_IDS) assert.ok(WEAPONS_BY_ID[id]);
});

test('evidence seals and offer tiers follow lifetime kills and cannot refund spent seals', () => {
  assert.equal(grpdEarnedSeals(999), 0);
  assert.equal(grpdEarnedSeals(1000), 1);
  assert.equal(grpdAvailableSeals(3000, 2), 1);
  assert.equal(grpdAvailableSeals(1000, 3), 0);
  assert.deepEqual([1, 2, 3, 4].map(grpdNextTierCost), [1, 2, 3, 4]);
  assert.equal(grpdOfferWeight(5, 0, 1), 5);
  assert.equal(grpdOfferWeight(5, 1000, 1), 5.05);
  assert.equal(grpdOfferWeight(5, 1000, 5), 25.25);
});

test('older saves have no fabricated or active archive weapons', () => {
  const old = createInitialMeta();
  const meta = normalizeMeta({ ...old, grpdUnlockedWeaponIds: undefined, grpdActiveWeaponIds: undefined, grpdSpawnTierByWeaponId: undefined, grpdSpentSeals: undefined });
  assert.deepEqual(meta.grpdUnlockedWeaponIds, []);
  assert.deepEqual(meta.grpdActiveWeaponIds, []);
  assert.equal(meta.grpdSpentSeals, 0);
});

test('only active GRPD prototypes appear among level-up choices', () => {
  const area = AREAS[0]!;
  const character = CHARACTERS[0]!;
  const base = createWorld(area, character, character.stats, 616, [], 1, true, null, { unlockedCharacterIds: [character.id] });
  const baseChoices = rollUpgradeChoices(base, 500);
  assert.ok(!baseChoices.some((choice) => GRPD_PLAYABLE_WEAPON_IDS.has(choice.weaponId ?? '')));

  const active = createWorld(area, character, character.stats, 616, [], 1, true, null, {
    unlockedCharacterIds: [character.id],
    grpdActiveWeaponIds: ['crossing-baton'],
    grpdCareerKills: 1000,
    grpdSpawnTierByWeaponId: { 'crossing-baton': 2 },
  });
  const activeChoices = rollUpgradeChoices(active, 500);
  assert.ok(activeChoices.some((choice) => choice.weaponId === 'crossing-baton'));
  assert.ok(!activeChoices.some((choice) => choice.weaponId === 'rivet-driver' || choice.weaponId === 'deck-sling'));
});

test('weapon chest rewards honor the archive switch', () => {
  const area = AREAS[0]!;
  const character = CHARACTERS[0]!;
  const chest = { kind: 'weapon' as const, label: 'Weapon' };
  for (let seed = 1; seed <= 40; seed += 1) {
    const world = createWorld(area, character, character.stats, seed, [], 1, true, null, { unlockedCharacterIds: [character.id] });
    claimLootPrize(world, chest);
    assert.ok(world.weapons.every((entry) => !GRPD_PLAYABLE_WEAPON_IDS.has(entry.def.id)));
  }
});
