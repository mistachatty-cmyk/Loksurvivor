import assert from 'node:assert/strict';
import test from 'node:test';

import { AREAS } from './areas';
import { CHARACTERS } from './characters';
import { GRPD_BLUEPRINTS, GRPD_PLAYABLE_WEAPON_IDS, grpdAvailableSeals, grpdEarnedSeals, grpdEndgameKillGoal, grpdEndgameWeaponEarned, grpdNextTierCost, grpdOfferWeight } from './grpdArmory';
import { WEAPONS_BY_ID } from './weapons';
import { PASSIVES_BY_ID } from './passives';
import { STANDARD_MAPS } from './endgameUnlocks';
import { claimLootPrize, createWorld, rollUpgradeChoices } from '@/game/engine/world';
import { createInitialMeta, normalizeMeta } from '@/game/state/metaStore';

test('GRPD archive keeps thirty unique designs and only completed prototypes can enter the loot pool', () => {
  assert.equal(GRPD_BLUEPRINTS.length, 30);
  assert.equal(new Set(GRPD_BLUEPRINTS.map((entry) => entry.id)).size, 30);
  assert.equal(GRPD_PLAYABLE_WEAPON_IDS.size, 7);
  for (const id of GRPD_PLAYABLE_WEAPON_IDS) assert.ok(WEAPONS_BY_ID[id]);
});

test('Victory Lap weapons open in alternating 750k and 1m lifetime-kill steps', () => {
  assert.deepEqual(['digifrog-lance', 'firewall-verse', 'rewind-mercy', 'eclipse-severance'].map(grpdEndgameKillGoal), [750_000, 1_750_000, 2_500_000, 3_500_000]);
  assert.equal(grpdEndgameWeaponEarned('digifrog-lance', 9_000_000, false), false);
  assert.equal(grpdEndgameWeaponEarned('digifrog-lance', 749_999, true), false);
  assert.equal(grpdEndgameWeaponEarned('digifrog-lance', 750_000, true), true);
  assert.equal(grpdEndgameWeaponEarned('firewall-verse', 750_000, true), false);
  assert.equal(grpdEndgameWeaponEarned('eclipse-severance', 3_500_000, true), true);
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
  assert.equal(grpdOfferWeight(5, 1000, 5, false), 25);
});

test('older saves have no fabricated or active archive weapons', () => {
  const old = createInitialMeta();
  const meta = normalizeMeta({ ...old, grpdUnlockedWeaponIds: undefined, grpdActiveWeaponIds: undefined, grpdSpawnTierByWeaponId: undefined, grpdSpentSeals: undefined, grpdAutoIncreaseEnabled: undefined });
  assert.deepEqual(meta.grpdUnlockedWeaponIds, []);
  assert.deepEqual(meta.grpdActiveWeaponIds, []);
  assert.equal(meta.grpdSpentSeals, 0);
  assert.equal(meta.grpdAutoIncreaseEnabled, true);
  assert.equal(normalizeMeta({ ...old, grpdAutoIncreaseEnabled: false }).grpdAutoIncreaseEnabled, false);
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

  const controlled = createWorld(area, character, character.stats, 616, [], 1, true, null, {
    unlockedCharacterIds: [character.id],
    grpdActiveWeaponIds: ['crossing-baton'],
    grpdCareerKills: 1000,
    grpdSpawnTierByWeaponId: { 'crossing-baton': 2 },
    grpdAutoIncreaseEnabled: false,
  });
  const controlledChoice = rollUpgradeChoices(controlled, 500).find((choice) => choice.weaponId === 'crossing-baton');
  const activeChoice = activeChoices.find((choice) => choice.weaponId === 'crossing-baton');
  assert.ok(controlledChoice && activeChoice);
  assert.equal(activeChoice.weight, controlledChoice.weight * 1.01);
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

test('earned endgame activation survives save normalization without letting an early save forge it', () => {
  const old = createInitialMeta();
  const ready = normalizeMeta({ ...old, totalKills: 750_000, clearedAreaIds: STANDARD_MAPS.map((area) => area.id), grpdActiveWeaponIds: ['digifrog-lance'] });
  assert.deepEqual(ready.grpdActiveWeaponIds, ['digifrog-lance']);
  const early = normalizeMeta({ ...old, totalKills: 750_000, grpdUnlockedWeaponIds: ['digifrog-lance'], grpdActiveWeaponIds: ['digifrog-lance'] });
  assert.deepEqual(early.grpdUnlockedWeaponIds, []);
  assert.deepEqual(early.grpdActiveWeaponIds, []);
});

test('endgame evolution offers require their complete recipe and the earned switch', () => {
  const character = CHARACTERS[0]!;
  const setup = (enabled: boolean) => {
    const world = createWorld(AREAS[0]!, character, character.stats, 616, [], 1, true, null, { endgameEvolutionsEnabled: enabled, grpdActiveWeaponIds: ['firewall-verse'] });
    world.weapons.push({ def: WEAPONS_BY_ID['firewall-verse']!, level: 8, count: 1, readyAt: 0 });
    world.weapons.push({ def: WEAPONS_BY_ID.boombox!, level: 8, count: 1, readyAt: 0 });
    world.passives.push({ def: PASSIVES_BY_ID.subwoofer!, stacks: 1 });
    return world;
  };
  assert.ok(!rollUpgradeChoices(setup(false), 500).some((choice) => choice.evolutionId === 'firewall-last-bar'));
  assert.ok(rollUpgradeChoices(setup(true), 500).some((choice) => choice.evolutionId === 'firewall-last-bar'));
  const missingPassive = setup(true);
  missingPassive.passives = [];
  assert.ok(!rollUpgradeChoices(missingPassive, 500).some((choice) => choice.evolutionId === 'firewall-last-bar'));
});
