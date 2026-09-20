import assert from 'node:assert/strict';
import test from 'node:test';

import { STARTER_LOKPET_FREE_REFRESH_MS, createInitialMeta, reducer } from './state/metaStore';
import { STARTER_LOKPET_IDS, starterLokPetEvolutionStage } from './data/lokPets';

test('starter encounter grants exactly one partner, two LokPacks, and 40 card credits', () => {
  const initial = { meta: createInitialMeta(), lastRun: null, lastCardPackReveal: null };
  const completed = reducer(initial, { type: 'completeStarterLokPetOnboarding', variantId: 'lil-llama', now: 616 });

  assert.equal(completed.meta.starterLokPetOnboardingComplete, true);
  assert.equal(completed.meta.starterLokPetVariantId, 'lil-llama');
  assert.equal(completed.meta.savedLokPets.length, 1);
  assert.equal(completed.meta.savedLokPets[0]?.starter, true);
  assert.equal(completed.meta.selectedLokPetIds[0], completed.meta.savedLokPets[0]?.id);
  assert.equal(completed.meta.cardCredits, 40);
  assert.equal(completed.lastCardPackReveal?.packId, 'lokpet');
  assert.equal(completed.lastCardPackReveal?.pulls.length, 4);
  assert.ok(completed.meta.lokPetCatalog.some((entry) => entry.variantId === 'lil-llama'));
  assert.ok(completed.meta.cardCollection.some((record) => record.cardId.includes(':pet-lil-llama') && record.copies >= 1));

  const replayed = reducer(completed, { type: 'completeStarterLokPetOnboarding', variantId: 'static-null', now: 999 });
  assert.equal(replayed, completed, 'the one-time reward cannot be duplicated or swapped by replaying the action');
});

test('starter partners refill for free on an hourly boundary', () => {
  const initial = { meta: createInitialMeta(), lastRun: null, lastCardPackReveal: null };
  const completed = reducer(initial, { type: 'completeStarterLokPetOnboarding', variantId: 'lil-buzbee', now: 1000 });
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

test('all starter choices have three level-driven evolution phases', () => {
  assert.equal(STARTER_LOKPET_IDS.length, 3);
  assert.equal(starterLokPetEvolutionStage(1), 1);
  assert.equal(starterLokPetEvolutionStage(33), 2);
  assert.equal(starterLokPetEvolutionStage(66), 3);
  assert.equal(starterLokPetEvolutionStage(99), 3);
});
