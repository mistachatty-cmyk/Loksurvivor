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
