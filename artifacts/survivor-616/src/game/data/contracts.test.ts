import assert from 'node:assert/strict';
import test from 'node:test';

import { AREAS } from '@/game/data/areas';
import { ENEMIES_BY_ID } from '@/game/data/enemies';
import {
  SIDE_JOB_DISTRICTS,
  SIDE_JOB_HUNT_TARGETS,
  advanceDailyContracts,
  contractDayKey,
  dailyContractDefs,
  dailyContractStatuses,
} from '@/game/data/contracts';

test('the Broadcast board has three deterministic contracts plus an optional wildcard per local day', () => {
  const day = contractDayKey(new Date(2026, 7, 30, 12).getTime());
  const first = dailyContractDefs(day);
  assert.deepEqual(dailyContractDefs(day), first);
  assert.equal(first.length, 7);
  assert.deepEqual(first.slice(0, 4).map((contract) => contract.kind), ['clear-area', 'kill-any', 'survive-sec', 'kill-any']);
  assert.equal(new Set(first.slice(4).map((contract) => contract.kind)).size, 3);
  assert.notDeepEqual(first, dailyContractDefs('2026-08-31'));
});

test('contract progress pays each completed contract once', () => {
  const day = '2026-08-30';
  const state = { dayKey: day, progressById: {}, completedIds: [] };
  const [clear, kill, survive, wildcard, ...side] = dailyContractDefs(day);
  const first = advanceDailyContracts(state, { cleared: false, kills: kill.targetCount - 1, survivedSec: survive.targetCount - 1 }, new Date(2026, 7, 30, 12).getTime());
  assert.equal(first.completed.length, 0);
  const second = advanceDailyContracts(first, { cleared: true, kills: wildcard.targetCount + 1, survivedSec: survive.targetCount }, new Date(2026, 7, 30, 13).getTime());
  assert.deepEqual(second.completed.map((contract) => contract.id), [clear.id, kill.id, survive.id, wildcard.id]);
  assert.equal(side.every((contract) => !second.completedIds.includes(contract.id)), true);
  assert.equal(second.rewardCred, clear.rewardCred + kill.rewardCred + survive.rewardCred + wildcard.rewardCred);
  assert.equal(second.rewardKeys, wildcard.rewardKeys);
  assert.equal(dailyContractStatuses(second, day).slice(0, 4).every((contract) => contract.completed), true);
  const repeat = advanceDailyContracts(second, { cleared: true, kills: 500, survivedSec: 500 }, new Date(2026, 7, 30, 14).getTime());
  assert.equal(repeat.completed.length, 0);
  assert.equal(repeat.rewardCred, 0);
  assert.equal(repeat.rewardKeys, 0);
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

test('side job targets all exist and are reachable from a fresh save', () => {
  for (const id of SIDE_JOB_HUNT_TARGETS) assert.ok(ENEMIES_BY_ID[id], `unknown hunt target ${id}`);
  const monroe = AREAS.find((area) => area.id === 'monroe-strip')!;
  const spawned = new Set(monroe.waves.map((wave) => wave.enemyId));
  for (const id of SIDE_JOB_HUNT_TARGETS) assert.ok(spawned.has(id), `${id} does not spawn in Monroe Strip`);
  for (const id of SIDE_JOB_DISTRICTS) {
    const area = AREAS.find((candidate) => candidate.id === id);
    assert.ok(area, `unknown district ${id}`);
    assert.equal(area.unlock.kind, 'default', `${id} is locked on a fresh save`);
  }
});

test('every side job kind pays out from the matching run stats', () => {
  const kinds = new Map<string, ReturnType<typeof dailyContractDefs>[number]>();
  for (let day = 1; day <= 30; day += 1) {
    const key = `2026-09-${String(day).padStart(2, '0')}`;
    for (const job of dailyContractDefs(key).slice(4)) {
      kinds.set(`${key}:${job.kind}`, job);
      const noon = new Date(2026, 8, day, 12).getTime();
      const run = {
        cleared: true,
        kills: 0,
        survivedSec: 0,
        areaId: job.targetId ?? 'monroe-strip',
        killsByEnemy: job.targetId ? { [job.targetId]: job.targetCount } : {},
        level: job.targetCount,
        cred: job.targetCount,
        lootBoxesOpened: job.targetCount,
        craftingMaterialsCollected: { scrap: job.targetCount },
        mapFindIds: Array.from({ length: job.targetCount }, (_, i) => `find-${i}`),
      };
      const advance = advanceDailyContracts({ dayKey: key, progressById: {}, completedIds: [] }, run, noon);
      assert.ok(advance.completedIds.includes(job.id), `${job.kind} did not complete`);
      const wrong = advanceDailyContracts({ dayKey: key, progressById: {}, completedIds: [] }, { cleared: false, kills: 0, survivedSec: 0 }, noon);
      assert.ok(!wrong.completedIds.includes(job.id), `${job.kind} completed on an empty run`);
    }
  }
  assert.ok(new Set([...kinds.values()].map((job) => job.kind)).size >= 7);
});
