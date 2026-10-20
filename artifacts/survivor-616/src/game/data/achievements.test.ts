import assert from 'node:assert/strict';
import test from 'node:test';

import { ACHIEVEMENTS } from '@/game/data/achievements';
import { createInitialMeta, reducer } from '@/game/state/metaStore';

test('achievement ids are unique and every reward pays a positive amount', () => {
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  for (const achievement of ACHIEVEMENTS) {
    if (achievement.reward) assert.ok(achievement.reward.amount > 0, `${achievement.id} rewards a non-positive amount`);
  }
});

test('a freshly created save has not completed any achievement', () => {
  const meta = createInitialMeta();
  for (const achievement of ACHIEVEMENTS) {
    assert.equal(achievement.isComplete(meta), false, `${achievement.id} should not be complete on a fresh save`);
  }
});

test('claiming a completed achievement pays its reward exactly once', () => {
  const meta = { ...createInitialMeta(), totalKills: 1 };
  const state = { meta, lastRun: null };

  const claimed = reducer(state, { type: 'claimAchievement', id: 'first-blood' });
  assert.equal(claimed.meta.cred, meta.cred + 25);
  assert.deepEqual(claimed.meta.claimedAchievementIds, ['first-blood']);

  const claimedAgain = reducer(claimed, { type: 'claimAchievement', id: 'first-blood' });
  assert.equal(claimedAgain.meta.cred, claimed.meta.cred, 'a second claim must not pay out again');
  assert.deepEqual(claimedAgain.meta.claimedAchievementIds, ['first-blood']);
});

test('claiming an incomplete or unknown achievement is a no-op', () => {
  const state = { meta: createInitialMeta(), lastRun: null };
  assert.equal(reducer(state, { type: 'claimAchievement', id: 'first-blood' }), state);
  assert.equal(reducer(state, { type: 'claimAchievement', id: 'not-a-real-achievement' }), state);
});

test('every quirk has an Everywhere and a Take it on achievement that complete at their kill counts', async () => {
  const { ENEMY_QUIRKS, QUIRK_EVERYWHERE_KILLS, QUIRK_TAKE_ON_KILLS } = await import('@/game/data/enemyQuirks');
  const { ACHIEVEMENTS_BY_ID } = await import('@/game/data/achievements');
  const fresh = createInitialMeta();
  for (const quirk of ENEMY_QUIRKS) {
    const everywhere = ACHIEVEMENTS_BY_ID[`quirk-everywhere-${quirk.id}`]!;
    const taken = ACHIEVEMENTS_BY_ID[`quirk-taken-${quirk.id}`]!;
    assert.ok(everywhere && taken);
    assert.equal(everywhere.isComplete({ ...fresh, quirkKills: { [quirk.id]: QUIRK_EVERYWHERE_KILLS - 1 } }), false);
    assert.equal(everywhere.isComplete({ ...fresh, quirkKills: { [quirk.id]: QUIRK_EVERYWHERE_KILLS } }), true);
    assert.equal(taken.isComplete({ ...fresh, quirkKills: { [quirk.id]: QUIRK_EVERYWHERE_KILLS } }), false);
    assert.equal(taken.isComplete({ ...fresh, quirkKills: { [quirk.id]: QUIRK_TAKE_ON_KILLS } }), true);
  }
  const all = Object.fromEntries(ENEMY_QUIRKS.map((quirk) => [quirk.id, QUIRK_TAKE_ON_KILLS]));
  for (const id of ['quirk-first-kill', 'quirk-collector', 'quirk-everywhere-all', 'quirk-taken-all']) {
    assert.equal(ACHIEVEMENTS_BY_ID[id]!.isComplete(fresh), false);
    assert.equal(ACHIEVEMENTS_BY_ID[id]!.isComplete({ ...fresh, quirkKills: all }), true);
  }
});

test('a finished run adds its quirk kills to the save and ignores unknown quirks', async () => {
  const { AREAS } = await import('@/game/data/areas');
  const { CHARACTERS } = await import('@/game/data/characters');
  const { buildResult, createWorld } = await import('@/game/engine/world');
  const world = createWorld(AREAS[0]!, CHARACTERS[0]!, CHARACTERS[0]!.stats, 1);
  world.killsByQuirk = { volatile: 2, gilded: 1, bogus: 5 };
  const state = { meta: createInitialMeta(), lastRun: null };
  const next = reducer(state, { type: 'completeRun', result: buildResult(world) });
  assert.deepEqual(next.meta.quirkKills, { volatile: 2, gilded: 1 });
  const again = reducer(next, { type: 'completeRun', result: buildResult(world) });
  assert.deepEqual(again.meta.quirkKills, { volatile: 4, gilded: 2 });
});

test('Gen Fitting Floor and quirk-option achievements complete from the save', async () => {
  const { ACHIEVEMENTS_BY_ID } = await import('@/game/data/achievements');
  const { FACTIONS_BY_ID } = await import('@/game/data/factions');
  const fresh = createInitialMeta();
  const roster = FACTIONS_BY_ID['gen-fitters']!.roster;
  const met = (id: string, patch: object) => ACHIEVEMENTS_BY_ID[id]!.isComplete({ ...fresh, ...patch });
  for (const id of ['gen-floor-cleared', 'gen-warden-down', 'gen-six-styles', 'gen-full-roster', 'quirk-everywhere-run', 'quirk-everywhere-run-10', 'quirk-taken-run', 'quirk-taken-run-10']) {
    assert.ok(ACHIEVEMENTS_BY_ID[id], id);
    assert.equal(ACHIEVEMENTS_BY_ID[id]!.isComplete(fresh), false, id);
  }
  assert.equal(met('gen-floor-cleared', { clearedAreaIds: ['gen-fitting-floor'] }), true);
  assert.equal(met('gen-warden-down', { bestiary: { 'gen-tile-warden': 1 } }), true);
  assert.equal(met('gen-full-roster', { bestiary: Object.fromEntries(roster.map((id) => [id, 1])) }), true);
  assert.equal(met('gen-full-roster', { bestiary: Object.fromEntries(roster.slice(1).map((id) => [id, 1])) }), false);
  assert.equal(met('gen-six-styles', { bestiary: Object.fromEntries(roster.slice(8).map((id) => [id, 1])) }), true);
  assert.equal(met('quirk-everywhere-run-10', { quirkEverywhereRuns: 9 }), false);
  assert.equal(met('quirk-everywhere-run-10', { quirkEverywhereRuns: 10 }), true);
  assert.equal(met('quirk-taken-run', { quirkTakenRuns: 1 }), true);
});

test('a run that used Everywhere or Take it on is counted once on the save', async () => {
  const { AREAS } = await import('@/game/data/areas');
  const { CHARACTERS } = await import('@/game/data/characters');
  const { buildResult, createWorld } = await import('@/game/engine/world');
  const world = createWorld(AREAS[0]!, CHARACTERS[0]!, CHARACTERS[0]!.stats, 1, [], 1, true, null, { enemyQuirks: { enabled: true, disabledIds: [], everywhereIds: ['gilded'], takenIds: ['flicker'] } });
  const next = reducer({ meta: createInitialMeta(), lastRun: null }, { type: 'completeRun', result: buildResult(world) });
  assert.equal(next.meta.quirkEverywhereRuns, 1);
  assert.equal(next.meta.quirkTakenRuns, 1);
  const plain = createWorld(AREAS[0]!, CHARACTERS[0]!, CHARACTERS[0]!.stats, 1);
  const after = reducer(next, { type: 'completeRun', result: buildResult(plain) });
  assert.equal(after.meta.quirkEverywhereRuns, 1);
  assert.equal(after.meta.quirkTakenRuns, 1);
});

test('Surge achievements complete at their thresholds and a survived Surge is counted once', async () => {
  const { ACHIEVEMENTS_BY_ID } = await import('@/game/data/achievements');
  const { AREAS } = await import('@/game/data/areas');
  const { CHARACTERS } = await import('@/game/data/characters');
  const { STANDARD_MAPS } = await import('@/game/data/endgameUnlocks');
  const { buildResult, createWorld } = await import('@/game/engine/world');
  const fresh = createInitialMeta();
  const met = (id: string, patch: object) => ACHIEVEMENTS_BY_ID[id]!.isComplete({ ...fresh, ...patch });
  for (const id of ['surge-glyph-reader', 'surge-first', 'surge-10', 'surge-50', 'victory-lap-reached']) assert.equal(met(id, {}), false, id);
  assert.equal(met('surge-glyph-reader', { clearedAreaIds: AREAS.slice(0, 13).map((a) => a.id) }), false);
  assert.equal(met('surge-glyph-reader', { clearedAreaIds: AREAS.slice(0, 14).map((a) => a.id) }), true);
  assert.equal(met('surge-first', { quirkSurgesSurvived: 1 }), true);
  assert.equal(met('surge-10', { quirkSurgesSurvived: 9 }), false);
  assert.equal(met('surge-50', { quirkSurgesSurvived: 50 }), true);
  assert.equal(met('victory-lap-reached', { clearedAreaIds: STANDARD_MAPS.map((a) => a.id) }), true);
  const world = createWorld(AREAS[0]!, CHARACTERS[0]!, CHARACTERS[0]!.stats, 1);
  world.quirkSurgePhase = 2;
  const next = reducer({ meta: fresh, lastRun: null }, { type: 'completeRun', result: buildResult(world) });
  assert.equal(next.meta.quirkSurgesSurvived, 1);
  world.quirkSurgePhase = 1;
  assert.equal(buildResult(world).quirkSurgeSurvived, false);
});

test('drop pack achievements track owned and equipped packs', () => {
  const fresh = createInitialMeta();
  const byId = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)!;
  const packs = fresh.ownedDropPackIds;
  assert.deepEqual(packs, ['potato']);
  const some = { ...fresh, ownedDropPackIds: ['potato', 'pop-cut', 'blueprint'], activeDropPackId: 'blueprint' };
  assert.equal(byId('pack-rat').isComplete(some), true);
  assert.equal(byId('new-loot-look').isComplete(some), true);
  assert.equal(byId('full-stash').isComplete(some), false);
});
