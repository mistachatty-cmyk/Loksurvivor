import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceDailyContracts,
  contractDayKey,
  dailyContractDefs,
  dailyContractStatuses,
} from '@/game/data/contracts';

test('the Broadcast board has three deterministic contracts per local day', () => {
  const day = contractDayKey(new Date(2026, 7, 30, 12).getTime());
  const first = dailyContractDefs(day);
  assert.deepEqual(dailyContractDefs(day), first);
  assert.equal(first.length, 3);
  assert.deepEqual(first.map((contract) => contract.kind), ['clear-area', 'kill-any', 'survive-sec']);
  assert.notDeepEqual(first, dailyContractDefs('2026-08-31'));
});

test('contract progress pays each completed contract once', () => {
  const day = '2026-08-30';
  const state = { dayKey: day, progressById: {}, completedIds: [] };
  const [clear, kill, survive] = dailyContractDefs(day);
  const first = advanceDailyContracts(state, { cleared: false, kills: kill.targetCount - 1, survivedSec: survive.targetCount - 1 }, new Date(2026, 7, 30, 12).getTime());
  assert.equal(first.completed.length, 0);
  const second = advanceDailyContracts(first, { cleared: true, kills: 1, survivedSec: survive.targetCount }, new Date(2026, 7, 30, 13).getTime());
  assert.deepEqual(second.completed.map((contract) => contract.id), [clear.id, kill.id, survive.id]);
  assert.equal(second.rewardCred, clear.rewardCred + kill.rewardCred + survive.rewardCred);
  assert.equal(dailyContractStatuses(second, day).every((contract) => contract.completed), true);
  const repeat = advanceDailyContracts(second, { cleared: true, kills: 500, survivedSec: 500 }, new Date(2026, 7, 30, 14).getTime());
  assert.equal(repeat.completed.length, 0);
  assert.equal(repeat.rewardCred, 0);
});

test('a new local day starts with a fresh board', () => {
  const oldDay = '2026-08-30';
  const next = advanceDailyContracts(
    { dayKey: oldDay, progressById: { [`${oldDay}:crowd-control`]: 12 }, completedIds: [] },
    { cleared: false, kills: 0, survivedSec: 0 },
    new Date(2026, 7, 31, 1).getTime(),
  );
  assert.equal(next.dayKey, '2026-08-31');
  assert.deepEqual(next.progressById, {});
  assert.deepEqual(next.completedIds, []);
});