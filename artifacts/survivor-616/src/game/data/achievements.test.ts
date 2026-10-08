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
