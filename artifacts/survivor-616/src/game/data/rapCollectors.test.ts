import assert from 'node:assert/strict';
import test from 'node:test';

import { AREAS } from './areas';
import { CHARACTERS_BY_ID } from './characters';
import { rollPrize } from './prizes';
import { createRng } from '../engine/math';
import { createWorld } from '../engine/world';
import {
  LOKPET_CARD_PACK_COST,
  cardCreditsForRun,
  createInitialMeta,
  isUnlocked,
  lokPetTeamCapacity,
  reducer,
} from '../state/metaStore';
import type { RunResult } from '../types';

const RAP_CREW_IDS = ['meter-monk', 'vinyl-hex', 'hook-ghost', 'sleeve'] as const;
const COLLECTOR_IDS = ['sleeve', 'crate-sage', 'foil-oracle', 'crown-binder', 'pack-supreme'] as const;

function resultFor(characterId: string, lootBoxesOpened: number, pets: RunResult['lokPets'] = []): RunResult {
  return {
    areaId: AREAS[0]!.id,
    characterId,
    cleared: false,
    survivedSec: 30,
    kills: 10,
    level: 2,
    cred: 10,
    killsByEnemy: {},
    newlyUnlockedCharacterIds: [],
    loadout: { weapons: [], passives: [] },
    lootBoxesOpened,
    openedPrizes: [],
    lokPets: pets,
    lokPetDiscoveries: [],
    lootTokensGained: 0,
    skeletonKeysGained: 0,
    completedObjectives: [],
  };
}

test('Sixth Ward Cypher has four playable identities and four distinct silhouettes', () => {
  const crew = RAP_CREW_IDS.map((id) => CHARACTERS_BY_ID[id]!);
  assert.ok(crew.every((character) => character.crew?.id === 'sixth-ward-cypher'));
  assert.equal(new Set(crew.map((character) => character.weapon.id)).size, crew.length);
  assert.equal(new Set(crew.map((character) => JSON.stringify(character.rig.parts))).size, crew.length);
  assert.ok(crew.every((character) => character.signatureTraits?.length === 2));
});

test('LokPet Collector ranks grow from one to seven extra loadout slots', () => {
  const collectors = COLLECTOR_IDS.map((id) => CHARACTERS_BY_ID[id]!);
  assert.deepEqual(collectors.map((character) => character.lokPetCollector?.extraTeamSlots), [1, 2, 3, 5, 7]);
  assert.deepEqual(collectors.map(lokPetTeamCapacity), [4, 5, 6, 8, 10]);
  assert.deepEqual(collectors.map((character) => character.lokPetCollector?.rank), [
    'LokPet Collector', 'LokMaster', 'LokCaster', 'LokLegendary', 'LokSupreme',
  ]);
});

test('collector challenge unlocks require both runs and caught LokPets', () => {
  const rule = CHARACTERS_BY_ID['crate-sage']!.unlock;
  const base = createInitialMeta();
  assert.equal(isUnlocked(rule, { ...base, lokCollectorRuns: 3, lokCollectorPetsFound: 2 }), false);
  assert.equal(isUnlocked(rule, { ...base, lokCollectorRuns: 2, lokCollectorPetsFound: 3 }), false);
  assert.equal(isUnlocked(rule, { ...base, lokCollectorRuns: 3, lokCollectorPetsFound: 3 }), true);
});

test('collector prize weighting produces more LokPet pulls', () => {
  const normalRng = createRng(616);
  const collectorRng = createRng(616);
  let normal = 0;
  let collector = 0;
  for (let index = 0; index < 2_000; index += 1) {
    if (rollPrize(normalRng).kind === 'lokpet') normal += 1;
    if (rollPrize(collectorRng, 2.8).kind === 'lokpet') collector += 1;
  }
  assert.ok(collector > normal * 1.8, `${collector} collector pulls should materially exceed ${normal} normal pulls`);
});

test('collector world and meta progression use the selected rank', () => {
  const collector = CHARACTERS_BY_ID['pack-supreme']!;
  const world = createWorld(AREAS[0]!, collector, collector.stats, 616);
  assert.equal(world.maxLokPets, 11, 'runtime keeps one catch slot beyond the ten-pet loadout');
  assert.equal(cardCreditsForRun(collector, 2), 18);

  const base = createInitialMeta();
  const completed = reducer({ meta: base, lastRun: null }, { type: 'completeRun', result: resultFor('pack-supreme', 2) });
  assert.equal(completed.meta.lokCollectorRuns, 1);
  assert.equal(completed.meta.cardCredits, 18);
});

test('LokPet card shop spends credits and saves the pulled companion', () => {
  const base = { ...createInitialMeta(), cardCredits: LOKPET_CARD_PACK_COST };
  const next = reducer({ meta: base, lastRun: null }, { type: 'buyLokPetCardPack', now: 616 });
  assert.equal(next.meta.cardCredits, 0);
  assert.equal(next.meta.savedLokPets.length, 1);
  assert.equal(next.meta.lokPetCatalog.length, 1);
});
