import assert from 'node:assert/strict';
import test from 'node:test';

import { createInitialMeta, isUnlocked, normalizeMeta, reducer } from './metaStore';
import { getCharacter } from '@/game/data/characters';

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
