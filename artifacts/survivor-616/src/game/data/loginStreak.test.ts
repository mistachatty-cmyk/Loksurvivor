import assert from 'node:assert/strict';
import test from 'node:test';

import { advanceLoginStreak, loginStreakReward } from '@/game/data/loginStreak';
import { contractDayKey } from '@/game/data/contracts';

test('claiming again the same day is a no-op', () => {
  const today = contractDayKey(new Date(2026, 7, 30, 12).getTime());
  const result = advanceLoginStreak(today, 3, new Date(2026, 7, 30, 18).getTime());
  assert.equal(result.reward, null);
  assert.equal(result.streakCount, 3);
  assert.equal(result.dayKey, today);
});

test('a consecutive-day claim increments the streak', () => {
  const yesterday = contractDayKey(new Date(2026, 7, 29, 9).getTime());
  const result = advanceLoginStreak(yesterday, 2, new Date(2026, 7, 30, 9).getTime());
  assert.equal(result.streakCount, 3);
  assert.notEqual(result.reward, null);
  assert.equal(result.reward!.day, 3);
});

test('a missed day resets the streak to 1', () => {
  const twoDaysAgo = contractDayKey(new Date(2026, 7, 28, 9).getTime());
  const result = advanceLoginStreak(twoDaysAgo, 5, new Date(2026, 7, 30, 9).getTime());
  assert.equal(result.streakCount, 1);
  assert.equal(result.reward!.day, 1);
});

test('an unset/empty prior day key is treated as a fresh streak', () => {
  const result = advanceLoginStreak('', 0, new Date(2026, 7, 30, 9).getTime());
  assert.equal(result.streakCount, 1);
});

test('the reward escalates across a 7-day cycle and pays keys on day 7', () => {
  const rewards = Array.from({ length: 7 }, (_, index) => loginStreakReward(index + 1));
  for (let i = 1; i < rewards.length; i += 1) {
    assert.ok(rewards[i]!.rewardCred > rewards[i - 1]!.rewardCred);
  }
  assert.equal(rewards[6]!.rewardKeys, 1);
  assert.ok(rewards.slice(0, 6).every((reward) => reward.rewardKeys === 0));
});

test('the cycle loops after day 7', () => {
  const day1 = loginStreakReward(1);
  const day8 = loginStreakReward(8);
  assert.equal(day8.rewardCred, day1.rewardCred);
  assert.equal(day8.rewardKeys, day1.rewardKeys);
  const day7 = loginStreakReward(7);
  const day14 = loginStreakReward(14);
  assert.equal(day14.rewardCred, day7.rewardCred);
  assert.equal(day14.rewardKeys, day7.rewardKeys);
});
