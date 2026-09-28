import assert from 'node:assert/strict';
import test from 'node:test';

import { createInitialMeta, isUnlocked, normalizeMeta, reducer } from './metaStore';
import { getCharacter } from '@/game/data/characters';

function withLegacyAttractModeStorage<T>(value: string | null, callback: () => T): T {
  const hadWindow = 'window' in globalThis;
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: { getItem: (key: string) => (key === 'survivor616.attractMode' ? value : null) } },
  });
  try {
    return callback();
  } finally {
    if (hadWindow) {
      Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow });
    } else {
      delete (globalThis as { window?: unknown }).window;
    }
  }
}

test('intro title physics defaults on, migrates older saves, and can be disabled', () => {
  assert.equal(createInitialMeta().introTitlePhysicsEnabled, true);
  assert.equal(createInitialMeta().introTitleReturnDelaySec, 4);
  assert.equal(normalizeMeta({ version: 1 }).introTitlePhysicsEnabled, true);
  assert.equal(normalizeMeta({ version: 1 }).introTitleReturnDelaySec, 4);
  assert.equal(normalizeMeta({ version: 1, introTitleReturnDelaySec: 99 }).introTitleReturnDelaySec, 12);
  assert.equal(normalizeMeta({ version: 1, introTitlePhysicsEnabled: false }).introTitlePhysicsEnabled, false);

  const updated = reducer(
    { meta: createInitialMeta(), lastRun: null },
    { type: 'setIntroTitlePhysicsEnabled', enabled: false },
  );
  assert.equal(updated.meta.introTitlePhysicsEnabled, false);

  const timed = reducer(updated, { type: 'setIntroTitleReturnDelay', seconds: 7 });
  assert.equal(timed.meta.introTitleReturnDelaySec, 7);
});

test('frame pacing defaults safely and only accepts the supported 60/120 modes', () => {
  assert.equal(createInitialMeta().frameRateMode, 60);
  assert.equal(normalizeMeta({ version: 1 }).frameRateMode, 60);
  assert.equal(normalizeMeta({ version: 1, frameRateMode: 120 }).frameRateMode, 120);
  assert.equal(normalizeMeta({ version: 1, frameRateMode: 144 }).frameRateMode, 60);

  const updated = reducer(
    { meta: createInitialMeta(), lastRun: null },
    { type: 'setFrameRateMode', mode: 120 },
  );
  assert.equal(updated.meta.frameRateMode, 120);
});

test('the title-screen background sim defaults on, migrates an old localStorage preference, and is toggleable', () => {
  assert.equal(createInitialMeta().attractModeEnabled, true);
  // No prior saved MetaState field and no legacy localStorage key -- default on.
  assert.equal(withLegacyAttractModeStorage(null, () => normalizeMeta({ version: 1 }).attractModeEnabled), true);
  // A pre-existing save already has the field -- respected as-is, legacy key ignored.
  assert.equal(
    withLegacyAttractModeStorage('off', () => normalizeMeta({ version: 1, attractModeEnabled: true }).attractModeEnabled),
    true,
  );
  // An old save with no field, but the player had turned the old on-canvas toggle off.
  assert.equal(withLegacyAttractModeStorage('off', () => normalizeMeta({ version: 1 }).attractModeEnabled), false);
  assert.equal(withLegacyAttractModeStorage('on', () => normalizeMeta({ version: 1 }).attractModeEnabled), true);

  const updated = reducer(
    { meta: createInitialMeta(), lastRun: null },
    { type: 'setAttractMode', enabled: false },
  );
  assert.equal(updated.meta.attractModeEnabled, false);
});

test('the hideout arrival scene defaults on, migrates safely, and is toggleable', () => {
  assert.equal(createInitialMeta().hideoutArrivalEnabled, true);
  assert.equal(normalizeMeta({ version: 1 }).hideoutArrivalEnabled, true);
  assert.equal(normalizeMeta({ version: 1, hideoutArrivalEnabled: false }).hideoutArrivalEnabled, false);

  const updated = reducer(
    { meta: createInitialMeta(), lastRun: null },
    { type: 'setHideoutArrival', enabled: false },
  );
  assert.equal(updated.meta.hideoutArrivalEnabled, false);
});

test('soundtrack objective progress safely defaults for older saves', () => {
  assert.equal(createInitialMeta().soundtrackObjectiveCompletions, 0);
  assert.equal(normalizeMeta({ version: 1 }).soundtrackObjectiveCompletions, 0);
  assert.equal(normalizeMeta({ version: 1, soundtrackObjectiveCompletions: 4 }).soundtrackObjectiveCompletions, 4);
  assert.equal(normalizeMeta({ version: 1, soundtrackObjectiveCompletions: -2 }).soundtrackObjectiveCompletions, 0);
});

test('Look Lab preferences migrate safely and persist through their reducers', () => {
  const migrated = normalizeMeta({ version: 1, lokPetArtStyle: 'holo-card', uiBorderStyle: 'round', lokPetBorderStyle: 'soft', characterBorderStyle: 'round' });
  assert.equal(migrated.lokPetArtStyle, 'holo-card');
  assert.equal(migrated.uiBorderStyle, 'round');
  assert.equal(migrated.lokPetBorderStyle, 'soft');
  assert.equal(migrated.characterBorderStyle, 'round');
  assert.equal(normalizeMeta({ version: 1, lokPetArtStyle: 'not-a-style', uiBorderStyle: 'sharp-ish' }).lokPetArtStyle, 'pixel-core');
  assert.equal(normalizeMeta({ version: 1, lokPetArtStyle: 'not-a-style', uiBorderStyle: 'sharp-ish' }).uiBorderStyle, 'square');
  assert.equal(normalizeMeta({ version: 1, lokPetBorderStyle: 'sharp-ish', characterBorderStyle: 'sharp-ish' }).lokPetBorderStyle, 'square');
  assert.equal(normalizeMeta({ version: 1, lokPetBorderStyle: 'sharp-ish', characterBorderStyle: 'sharp-ish' }).characterBorderStyle, 'square');

  const artUpdated = reducer(
    { meta: createInitialMeta(), lastRun: null },
    { type: 'setLokPetArtStyle', style: 'neon-signal' },
  );
  const borderUpdated = reducer(reducer(reducer(artUpdated, { type: 'setUiBorderStyle', style: 'soft' }), { type: 'setLokPetBorderStyle', style: 'round' }), { type: 'setCharacterBorderStyle', style: 'soft' });
  assert.equal(borderUpdated.meta.lokPetArtStyle, 'neon-signal');
  assert.equal(borderUpdated.meta.uiBorderStyle, 'soft');
  assert.equal(borderUpdated.meta.lokPetBorderStyle, 'round');
  assert.equal(borderUpdated.meta.characterBorderStyle, 'soft');
});

test('Llamasté is available from the hideout on new and returning saves', () => {
  assert.ok(createInitialMeta().unlockedCharacterIds.includes('llamaste'));
  assert.ok(normalizeMeta({ version: 1, unlockedCharacterIds: ['shade'] }).unlockedCharacterIds.includes('llamaste'));
});

test('Llamá Máma inherits the Crystal Cellar unlock', () => {
  const freshMeta = createInitialMeta();
  assert.equal(isUnlocked(getCharacter('llama-mama').unlock, freshMeta), false);
  assert.equal(
    isUnlocked(getCharacter('llama-mama').unlock, { ...freshMeta, clearedAreaIds: ['crystal-cellar'] }),
    true,
  );
});

test('the GRPD Vault grants Blue 616 once after the Site Crew zone is cleared', () => {
  const initial = { meta: createInitialMeta(), lastRun: null, lastCardPackReveal: null };
  assert.equal(reducer(initial, { type: 'claimLegendaryPoliceDog' }), initial);

  const eligible = {
    ...initial,
    meta: { ...initial.meta, clearedAreaIds: [...initial.meta.clearedAreaIds, 'site-crew-active-zone'] },
  };
  const claimed = reducer(eligible, { type: 'claimLegendaryPoliceDog' });
  const blue = claimed.meta.savedLokPets.find((pet) => pet.roll.variantId === 'blue-616');
  assert.ok(blue);
  assert.equal(blue.id, 'pet-grpd-blue-616');
  assert.equal(blue.roll.name, 'Blue 616');
  assert.equal(blue.roll.rarity, 'mythic');
  assert.equal(blue.roll.rarityLabel, 'Legendary');
  assert.equal(blue.roll.legendary, true);
  assert.equal(blue.favorite, true);

  const repeated = reducer(claimed, { type: 'claimLegendaryPoliceDog' });
  assert.equal(repeated, claimed);
  assert.equal(repeated.meta.savedLokPets.filter((pet) => pet.roll.variantId === 'blue-616').length, 1);
});
