import assert from 'node:assert/strict';
import test from 'node:test';
import { ALLIES } from '@/game/data/progression';
import { CREW_ACTIVITIES, preferredActivitiesForAlly, rollCrewActivities } from '@/game/data/crewActivities';

test('every rescued ally has multiple jobs in their own room', () => {
  assert.equal(new Set(CREW_ACTIVITIES.map((job) => job.id)).size, CREW_ACTIVITIES.length);
  for (const ally of ALLIES) {
    const jobs = preferredActivitiesForAlly(ally.id);
    assert.ok(jobs.length >= 2, `${ally.id} needs at least two reachable jobs`);
    assert.ok(jobs.every((job) => job.roomId === ally.room));
  }
});

test('crew rotation is repeatable and offers multiple outcomes', () => {
  const ids = ALLIES.map((ally) => ally.id);
  assert.deepEqual(rollCrewActivities(ids, 7), rollCrewActivities(ids, 7));
  assert.ok(new Set(Array.from({ length: 16 }, (_, seed) => rollCrewActivities(['patch-mercer'], seed)['patch-mercer'])).size > 1);
});
