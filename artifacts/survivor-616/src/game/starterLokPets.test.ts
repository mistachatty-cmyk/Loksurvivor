import assert from 'node:assert/strict';
import test from 'node:test';

import { STARTER_LOKPET_FREE_REFRESH_MS, createInitialMeta, reducer } from './state/metaStore';
import { STARTER_LOKPET_IDS, starterLokPetEvolutionStage } from './data/lokPets';
import { AREAS } from './data/areas';
import type { RunResult } from './types';

function resultFor(characterId: string): RunResult {
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
    lootBoxesOpened: 0,
    openedPrizes: [],
    lokPets: [],
    lokPetDiscoveries: [],
    lootTokensGained: 0,
    skeletonKeysGained: 0,
    completedObjectives: [],
  };
}

test('starter encounter grants exactly one partner, two LokPacks, and 40 card credits', () => {
  const initial = { meta: createInitialMeta(), lastRun: null, lastCardPackReveal: null };
  const completed = reducer(initial, { type: 'completeStarterLokPetOnboarding', variantId: 'lil-llama', characterId: 'queenbee', now: 616 });

  assert.equal(completed.meta.starterLokPetOnboardingComplete, true);
  assert.equal(completed.meta.starterLokPetVariantId, 'lil-llama');
  assert.equal(completed.meta.selectedCharacterId, 'queenbee');
  assert.equal(completed.meta.savedLokPets.length, 1);
  assert.equal(completed.meta.savedLokPets[0]?.starter, true);
  assert.equal(completed.meta.selectedLokPetIds[0], completed.meta.savedLokPets[0]?.id);
  assert.equal(completed.meta.cardCredits, 40);
  assert.equal(completed.lastCardPackReveal?.packId, 'lokpet');
  assert.equal(completed.lastCardPackReveal?.pulls.length, 4);
  assert.ok(completed.meta.lokPetCatalog.some((entry) => entry.variantId === 'lil-llama'));
  assert.ok(completed.meta.cardCollection.some((record) => record.cardId.includes(':pet-lil-llama') && record.copies >= 1));

  const replayed = reducer(completed, { type: 'completeStarterLokPetOnboarding', variantId: 'static-null', characterId: 'shade', now: 999 });
  assert.equal(replayed, completed, 'the one-time reward cannot be duplicated or swapped by replaying the action');
});

test('starter partners refill for free on an hourly boundary', () => {
  const initial = { meta: createInitialMeta(), lastRun: null, lastCardPackReveal: null };
  const completed = reducer(initial, { type: 'completeStarterLokPetOnboarding', variantId: 'lil-buzbee', characterId: 'shade', now: 1000 });
  const depleted = {
    ...completed,
    meta: {
      ...completed.meta,
      savedLokPets: completed.meta.savedLokPets.map((pet) => ({ ...pet, stamina: 0 })),
    },
  };
  const refreshed = reducer(depleted, { type: 'refreshPetElixirs', now: 1000 + STARTER_LOKPET_FREE_REFRESH_MS });
  assert.equal(refreshed.meta.savedLokPets[0]?.stamina, 3);
});

test('the starter companion never benches, even after its stamina would otherwise run out', () => {
  const initial = { meta: createInitialMeta(), lastRun: null, lastCardPackReveal: null };
  const completed = reducer(initial, { type: 'completeStarterLokPetOnboarding', variantId: 'lil-buzbee', characterId: 'shade', now: 500 });
  const starterId = completed.meta.savedLokPets[0]!.id;
  assert.equal(completed.meta.savedLokPets[0]?.starter, true);

  let state = completed;
  for (let run = 0; run < 6; run += 1) {
    state = reducer(state, { type: 'completeRun', result: resultFor('shade') });
  }

  const starterAfterRuns = state.meta.savedLokPets.find((pet) => pet.id === starterId);
  assert.ok(starterAfterRuns, 'the starter companion is never dropped from savedLokPets');
  assert.equal(starterAfterRuns?.stamina, 3, 'the starter companion never loses stamina from runs');
  assert.ok(state.meta.selectedLokPetIds.includes(starterId), 'the starter companion stays selected for every future run');
});

test('all starter choices have three level-driven evolution phases', () => {
  assert.equal(STARTER_LOKPET_IDS.length, 3);
  assert.equal(starterLokPetEvolutionStage(1), 1);
  assert.equal(starterLokPetEvolutionStage(33), 2);
  assert.equal(starterLokPetEvolutionStage(66), 3);
  assert.equal(starterLokPetEvolutionStage(99), 3);
});
