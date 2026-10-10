import assert from 'node:assert/strict';
import test from 'node:test';
import { createCrewWanderState, crewWanderFacing, stepCrewWander } from './hideoutCrewWander';

const RANGE = { min: 0, max: 400 };

test('stays idle until its scheduled time, even with eligible NPCs present', () => {
  const state = createCrewWanderState(0, () => 0.5);
  assert.ok(state.nextAt > 0, 'should roll a future, non-zero gap');
  stepCrewWander(state, { now: 1000, dt: 16, eligible: [{ id: 'ally-a', x: 100 }], range: RANGE, rng: () => 0.5 });
  assert.equal(state.activeId, null, 'should not start before its rolled time');
});

test('one NPC wanders out, pauses, then returns home and clears', () => {
  const state = createCrewWanderState(0, () => 0); // nextAt = now + min gap
  const eligible = [{ id: 'ally-a', x: 100 }];
  // Force the wander to start right at its scheduled time.
  stepCrewWander(state, { now: state.nextAt, dt: 16, eligible, range: RANGE, rng: () => 0 });
  assert.equal(state.activeId, 'ally-a');
  assert.equal(state.homeX, 100);
  assert.equal(state.phase, 'out');
  assert.notEqual(state.targetX, 100);

  // Walk it all the way to the target (big dt so one step arrives).
  let now = state.nextAt;
  for (let i = 0; i < 200 && state.phase === 'out'; i += 1) {
    now += 200;
    stepCrewWander(state, { now, dt: 200, eligible, range: RANGE, rng: () => 0 });
  }
  assert.equal(state.phase, 'pause', 'should pause once it reaches its target');
  assert.equal(state.x, state.targetX);

  // Pausing should not move it or resume early.
  stepCrewWander(state, { now: now + 1, dt: 16, eligible, range: RANGE, rng: () => 0 });
  assert.equal(state.phase, 'pause');

  // After the pause elapses it heads back home.
  now += 5000;
  stepCrewWander(state, { now, dt: 16, eligible, range: RANGE, rng: () => 0 });
  assert.equal(state.phase, 'back');
  assert.equal(state.targetX, 100);

  for (let i = 0; i < 200 && state.activeId !== null; i += 1) {
    now += 200;
    stepCrewWander(state, { now, dt: 200, eligible, range: RANGE, rng: () => 0 });
  }
  assert.equal(state.activeId, null, 'should clear once back home');
  assert.ok(state.nextAt > now, 'should roll another far-future gap before wandering again');
});

test('only ever wanders one NPC at a time', () => {
  const state = createCrewWanderState(0, () => 0);
  const eligible = [{ id: 'ally-a', x: 50 }, { id: 'ally-b', x: 300 }];
  stepCrewWander(state, { now: state.nextAt, dt: 16, eligible, range: RANGE, rng: () => 0.9 });
  const picked = state.activeId;
  assert.ok(picked === 'ally-a' || picked === 'ally-b');
  // A second roll attempt while one is already active must not pick the other.
  stepCrewWander(state, { now: state.nextAt + 16, dt: 16, eligible, range: RANGE, rng: () => 0.1 });
  assert.equal(state.activeId, picked);
});

test('snaps off cleanly if its prop disappears mid-wander (e.g. the player changed rooms)', () => {
  const state = createCrewWanderState(0, () => 0);
  stepCrewWander(state, { now: state.nextAt, dt: 16, eligible: [{ id: 'ally-a', x: 100 }], range: RANGE, rng: () => 0.5 });
  assert.equal(state.activeId, 'ally-a');
  stepCrewWander(state, { now: state.nextAt + 100, dt: 16, eligible: [], range: RANGE, rng: () => 0.5 });
  assert.equal(state.activeId, null);
});

test('crewWanderFacing follows travel direction while moving, and falls back when idle', () => {
  const state = createCrewWanderState(0, () => 0);
  assert.equal(crewWanderFacing(state, 1), 1, 'idle should use the fallback');
  assert.equal(crewWanderFacing(state, -1), -1);
  stepCrewWander(state, { now: state.nextAt, dt: 16, eligible: [{ id: 'ally-a', x: 100 }], range: RANGE, rng: () => 1 });
  const facing = state.targetX > state.x ? 1 : -1;
  assert.equal(crewWanderFacing(state, facing === 1 ? -1 : 1), facing, 'should face the direction of travel, not the fallback');
});
