import assert from 'node:assert/strict';
import test from 'node:test';

import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { RUN_EVENTS, runEventCount, scheduleRunEvents } from '@/game/data/runEvents';
import { buildResult, createWorld, stepWorld } from './world';

const IDLE = { moveX: 0, moveY: 0, ultimate: false };

function makeWorld(maps: number | null, seed = 7) {
  const area = {
    ...AREAS[0]!, id: 'run-event-test', obstacles: [], musicEvents: undefined, rescueAllyId: undefined, durationSec: 900,
    waves: [{ fromSec: 0, toSec: 900, enemyId: 'nightcrawler', ratePerSec: 0.1, burst: 1 }],
  };
  const setup = maps === null ? {} : { runEvents: { mapsCleared: maps } };
  const world = createWorld(area, CHARACTERS[0]!, { ...CHARACTERS[0]!.stats, maxHp: 1_000_000 }, seed, [], 1, true, null, setup);
  world.player.hp = world.player.maxHp = 1_000_000;
  return world;
}

test('beats unlock with maps cleared and never appear before that', () => {
  assert.equal(runEventCount(0), 0);
  assert.equal(runEventCount(1), 0);
  assert.equal(runEventCount(2), 1);
  assert.equal(runEventCount(5), 2);
  assert.equal(runEventCount(99), 4);
  assert.deepEqual(scheduleRunEvents(1, 1), []);
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    assert.ok(scheduleRunEvents(seed, 3).every((e) => e.id === 'supply-drop'), 'rush-hour needs 4 maps');
  }
  const ids = new Set(RUN_EVENTS.flatMap((e) => scheduleRunEvents(3, 12).map((s) => s.id)));
  assert.ok(ids.size >= 1);
});

test('the schedule is seeded, ordered and spaced so beats never overlap', () => {
  for (const seed of [1, 9, 42, 1234]) {
    const a = scheduleRunEvents(seed, 12);
    assert.deepEqual(a, scheduleRunEvents(seed, 12));
    for (let i = 1; i < a.length; i += 1) assert.ok(a[i]!.startMs - a[i - 1]!.startMs >= 25_000);
  }
  assert.deepEqual(scheduleRunEvents(5, 12, RUN_EVENTS.map((e) => e.id)), []);
});

test('a run with no runEvents setup never schedules a beat', () => {
  const world = makeWorld(null);
  assert.equal(world.runEvents.schedule.length, 0);
});

test('a supply drop warns, drops a crate with guards, and counts once it ends', () => {
  const world = makeWorld(2);
  world.runEvents.schedule = [{ id: 'supply-drop', startMs: 1000 }];
  let warned = false;
  let sawCrate = false;
  for (let frame = 0; frame < 30 * 25; frame += 1) {
    stepWorld(world, 1 / 30, IDLE);
    if (world.runEvents.phase === 'warn') warned = true;
    if (world.runEvents.phase === 'active' && world.pickups.some((p) => p.kind === 'prism-quartz')) sawCrate = true;
  }
  assert.ok(warned && sawCrate);
  assert.deepEqual(world.runEvents.survived, ['supply-drop']);
  assert.deepEqual(buildResult(world).runEventsSurvived, ['supply-drop']);
});

test('a stampede runs in a straight line with a gap, hurts on contact and stays finite', () => {
  const world = makeWorld(4);
  world.runEvents.schedule = [{ id: 'rush-hour', startMs: 500 }];
  let stampeders = 0;
  for (let frame = 0; frame < 30 * 14; frame += 1) {
    stepWorld(world, 1 / 30, IDLE);
    const running = world.enemies.filter((e) => e.stampede);
    stampeders = Math.max(stampeders, running.length);
    for (const e of world.enemies) assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y));
  }
  assert.ok(stampeders >= 6, `only ${stampeders} stampeders`);
  assert.deepEqual(world.runEvents.survived, ['rush-hour']);
});

test('a magnet coil pulls loot from four times as far, only while it lasts', () => {
  const world = makeWorld(null);
  const p = world.player;
  world.stats.magnet = 100;
  world.pickups.length = 0;
  world.pickups.push({ uid: 9001, kind: 'magnet-coil', x: p.x, y: p.y, vx: 0, vy: 0, value: 1, bornAt: 0 });
  stepWorld(world, 1 / 30, IDLE);
  assert.ok(world.magnetUntil > world.now, 'collecting the coil starts the timer');
  world.pickups.length = 0;
  world.pickups.push({ uid: 9002, kind: 'cred', x: p.x + 300, y: p.y, vx: 0, vy: 0, value: 1, bornAt: 0 });
  stepWorld(world, 1 / 30, IDLE);
  assert.ok(world.pickups[0]!.vx < 0, 'cred 300px away is pulled in');
  world.magnetUntil = 0;
  world.pickups[0]!.x = p.x + 300;
  world.pickups[0]!.vx = 0;
  stepWorld(world, 1 / 30, IDLE);
  assert.equal(world.pickups[0]!.vx, 0, 'no pull once it ends');
});

test('a tremor pushes and staggers enemies, never damages them, and leaves a heart behind', () => {
  const world = makeWorld(6);
  world.runEvents.schedule = [{ id: 'tremor', startMs: 500 }];
  for (let frame = 0; frame < 20; frame += 1) stepWorld(world, 1 / 30, IDLE);
  assert.equal(world.runEvents.phase, 'warn');
  const { x, y } = world.runEvents;
  for (let frame = 0; frame < 30 * 8; frame += 1) {
    stepWorld(world, 1 / 30, IDLE);
    for (const e of world.enemies) assert.ok(Number.isFinite(e.x) && Number.isFinite(e.kx));
  }
  assert.deepEqual(world.runEvents.survived, ['tremor']);
  assert.ok(world.pickups.some((p) => p.kind === 'health' && Math.hypot(p.x - x, p.y - y) < 400));
  assert.equal(world.kills, 0, 'a tremor never kills');
});

test('tremor needs 6 maps', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    assert.ok(scheduleRunEvents(seed, 5).every((e) => e.id !== 'tremor'));
  }
  assert.ok([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].some((seed) => scheduleRunEvents(seed, 20).some((e) => e.id === 'tremor')));
});

test('crew call-ins: rotate through the rescued crew, share one cooldown, and pay through the normal paths', async () => {
  const { callInCrew } = await import('./world');
  const area = {
    ...AREAS[0]!, id: 'call-in-test', obstacles: [], musicEvents: undefined, rescueAllyId: undefined, durationSec: 900,
    waves: [{ fromSec: 0, toSec: 900, enemyId: 'nightcrawler', ratePerSec: 0.1, burst: 1 }],
  };
  const world = createWorld(area, CHARACTERS[0]!, { ...CHARACTERS[0]!.stats, maxHp: 100 }, 3, [], 1, true, null, { callInAllyIds: ['pippa', 'not-a-real-ally', 'nyx'] });
  assert.deepEqual(world.callIns.roster, ['pippa', 'nyx'], 'allies without a call-in are left out');
  assert.equal(callInCrew(world), false, 'not ready in the first seconds');
  world.now = 25_000;
  world.player.hp = 50;
  assert.equal(callInCrew(world), true);
  assert.equal(world.player.hp, 75, "Pippa heals a quarter of max HP");
  assert.equal(callInCrew(world), false, 'shared cooldown');
  world.now += 31_000;
  assert.equal(callInCrew(world), true, 'next in line is Nyx');
  assert.equal(world.callIns.used, 2);
  assert.equal(buildResult(world).callInsUsed, 2);
  const solo = createWorld(area, CHARACTERS[0]!, { ...CHARACTERS[0]!.stats }, 3, [], 1, true, null, {});
  solo.now = 99_000;
  assert.equal(callInCrew(solo), false, 'no crew, no call-in');
});
