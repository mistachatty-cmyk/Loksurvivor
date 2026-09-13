import assert from 'node:assert/strict';
import test from 'node:test';

import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { CHARACTER_EPISODE_BY_CHARACTER_ID } from '@/game/data/episodes';
import {
  characterChecklist,
  characterMasteryKills,
  characterMasteryLevel,
  hasClearedEveryAreaAs,
  killsForMasteryLevel,
  KILLS_PER_MASTERY_LEVEL,
  MASTERY_SKIN_LEVELS,
} from '@/game/data/characterMastery';
import { characterSkinId } from '@/game/data/characterSkins';
import { createInitialMeta, normalizeMeta, reducer } from '@/game/state/metaStore';
import type { RunResult } from '@/game/types';

function runResult(overrides: Partial<RunResult> = {}): RunResult {
  return {
    areaId: AREAS[0]!.id,
    characterId: CHARACTERS[0]!.id,
    cleared: true,
    survivedSec: 30,
    kills: 4,
    level: 2,
    cred: 10,
    killsByEnemy: {},
    newlyUnlockedCharacterIds: [],
    loadout: { weapons: [], passives: [] },
    lootBoxesOpened: 0,
    openedPrizes: [],
    lokPets: [],
    lootTokensGained: 0,
    skeletonKeysGained: 0,
    completedObjectives: [],
    ...overrides,
  };
}

test('mastery level is a flat divisor over lifetime kills, with no cap', () => {
  const character = CHARACTERS[0]!;
  const meta = { ...createInitialMeta(), killsByCharacter: { [character.id]: 2499 } };
  assert.equal(characterMasteryLevel(character.id, meta), Math.floor(2499 / KILLS_PER_MASTERY_LEVEL));
  assert.equal(characterMasteryKills(character.id, meta), 2499);
  assert.equal(characterMasteryLevel('unplayed-character', meta), 0);

  for (const level of MASTERY_SKIN_LEVELS) {
    const exact = { ...createInitialMeta(), killsByCharacter: { [character.id]: killsForMasteryLevel(level) } };
    assert.ok(characterMasteryLevel(character.id, exact) >= level);
    const short = { ...createInitialMeta(), killsByCharacter: { [character.id]: killsForMasteryLevel(level) - 1 } };
    assert.ok(characterMasteryLevel(character.id, short) < level);
  }
});

test('a character checklist bundles their episode (if any), all three mastery tiers, and clearing every district', () => {
  const character = CHARACTERS[0]!;
  const fresh = characterChecklist(character, createInitialMeta());
  assert.equal(fresh.completedCount, 0);
  assert.equal(fresh.allComplete, false);
  assert.ok(fresh.items.some((item) => item.id === 'mastery-100'));
  assert.ok(fresh.items.some((item) => item.id === 'mastery-500'));
  assert.ok(fresh.items.some((item) => item.id === 'mastery-1000'));
  assert.ok(fresh.items.some((item) => item.id === 'every-district'));

  const episode = CHARACTER_EPISODE_BY_CHARACTER_ID[character.id];
  const maxed = {
    ...createInitialMeta(),
    killsByCharacter: { [character.id]: killsForMasteryLevel(1000) },
    clearedAreaIdsByCharacter: { [character.id]: AREAS.map((area) => area.id) },
    completedEpisodeIds: episode ? [episode.id] : [],
  };
  const finished = characterChecklist(character, maxed);
  assert.equal(hasClearedEveryAreaAs(character.id, maxed), true);
  assert.equal(finished.completedCount, finished.totalCount);
  assert.equal(finished.allComplete, true);
});

test('completing a run tallies kills and cleared areas per character', () => {
  const character = CHARACTERS[0]!;
  let state = { meta: createInitialMeta(), lastRun: null };
  state = reducer(state, { type: 'completeRun', result: runResult({ characterId: character.id, kills: 10, cleared: true, areaId: AREAS[0]!.id }) });
  assert.equal(state.meta.killsByCharacter[character.id], 10);
  assert.deepEqual(state.meta.clearedAreaIdsByCharacter[character.id], [AREAS[0]!.id]);

  state = reducer(state, { type: 'completeRun', result: runResult({ characterId: character.id, kills: 5, cleared: false, areaId: AREAS[1]!.id }) });
  assert.equal(state.meta.killsByCharacter[character.id], 15);
  // An uncleared run must not credit a district clear.
  assert.deepEqual(state.meta.clearedAreaIdsByCharacter[character.id], [AREAS[0]!.id]);
});

test('crossing a mastery milestone reports the newly unlocked skin id exactly once', () => {
  const character = CHARACTERS[0]!;
  const justBelow = { ...createInitialMeta(), killsByCharacter: { [character.id]: killsForMasteryLevel(100) - 3 } };
  const crossing = reducer(
    { meta: justBelow, lastRun: null },
    { type: 'completeRun', result: runResult({ characterId: character.id, kills: 3, cleared: false }) },
  );
  assert.deepEqual(crossing.lastRun?.newlyUnlockedSkinIds, [characterSkinId(character.id, 'onyx')]);

  const staysAbove = reducer(crossing, { type: 'completeRun', result: runResult({ characterId: character.id, kills: 1, cleared: false }) });
  assert.deepEqual(staysAbove.lastRun?.newlyUnlockedSkinIds, []);
});

test('save normalization drops kills/cleared-area entries for unknown character ids', () => {
  const character = CHARACTERS[0]!;
  const loaded = normalizeMeta({
    version: 1,
    killsByCharacter: { [character.id]: 42, 'not-a-character': 999 },
    clearedAreaIdsByCharacter: { [character.id]: [AREAS[0]!.id, 'not-an-area'], 'not-a-character': [AREAS[0]!.id] },
  });
  assert.deepEqual(loaded.killsByCharacter, { [character.id]: 42 });
  assert.deepEqual(loaded.clearedAreaIdsByCharacter, { [character.id]: [AREAS[0]!.id] });
});
