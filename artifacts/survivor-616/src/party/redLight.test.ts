import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIGHT, createRedLight, lightResults, stepRedLight, type LightState } from './redLight';
import type { StageInput } from './minigameKit';

const seats = ['zero-day', 'shade', 'quarry-kid', 'golden-hour'].map((characterId) => ({ characterId, bot: true, botSkill: 0.6 }));
const idle: StageInput = { keys: { x: 0, y: 0 }, aim: null, holding: false, tap: null, action: false };
const tap: StageInput = { ...idle, tap: { x: 0, y: 0 } };

function run(s: LightState, ms: number, input: StageInput | null = null) {
  for (let t = 0; t < ms && !s.over; t += 1000 / 60) stepRedLight(s, [input, null, null, null], 1000 / 60);
}
function untilPhase(s: LightState, phase: string) {
  while (!s.over && s.phase !== phase) stepRedLight(s, [null, null, null, null], 1000 / 60);
}

test('red light: taps move you on green and the track is finishable', () => {
  const s = createRedLight(3, [{ characterId: 'zero-day', bot: false }]);
  s.phaseUntil = 1e9;
  run(s, 3000, tap);
  assert.ok(s.runners[0].dist > 40);
  run(s, 20000, tap);
  assert.equal(s.runners[0].finishOrder, 1);
  assert.ok(s.over);
});

test('red light: a tap after the grace window on red blows you up; the warning is safe', () => {
  const s = createRedLight(4, [{ characterId: 'zero-day', bot: false }, { characterId: 'shade', bot: true }]);
  untilPhase(s, 'warn');
  stepRedLight(s, [tap, null], 16);
  assert.equal(s.runners[0].alive, true, 'moving on the warning is safe');
  untilPhase(s, 'red');
  run(s, LIGHT.graceMs - 70);
  stepRedLight(s, [tap, null], 16);
  assert.equal(s.runners[0].alive, true, 'inside the grace window is forgiven');
  run(s, 70);
  stepRedLight(s, [tap, null], 16);
  assert.equal(s.runners[0].alive, false);
  assert.ok(s.events.some((e) => e.type === 'zap'));
  const before = s.runners[0].dist;
  stepRedLight(s, [tap, null], 16);
  assert.equal(s.runners[0].dist, before, 'a blown up runner cannot move');
});

test('red light: anyone can fail, even everyone, and the game still ends with results', () => {
  const s = createRedLight(5, seats.map((x) => ({ ...x, bot: false })));
  untilPhase(s, 'red');
  run(s, LIGHT.graceMs + 40);
  stepRedLight(s, [tap, tap, tap, tap], 16);
  assert.ok(s.runners.every((r) => !r.alive));
  assert.ok(s.over);
  assert.equal(lightResults(s).length, 4);
});

test('red light: finishers beat runners, runners beat the blown up at the same distance', () => {
  const s = createRedLight(6, seats);
  s.runners[0].dist = 100;
  s.runners[0].finishOrder = 1;
  s.runners[1].dist = 60;
  s.runners[2].dist = 60;
  s.runners[2].alive = false;
  s.runners[3].dist = 10;
  const r = lightResults(s);
  assert.deepEqual(r.map((x) => x.index), [0, 1, 2, 3]);
});

test('red light: same seed, same bots, same result; bots are not all safe', () => {
  const a = createRedLight(7, seats);
  const b = createRedLight(7, seats);
  while (!a.over) stepRedLight(a, [null, null, null, null], 1000 / 60);
  while (!b.over) stepRedLight(b, [null, null, null, null], 1000 / 60);
  assert.deepEqual(lightResults(a), lightResults(b));
  let blown = 0;
  let games = 0;
  for (let seed = 1; seed <= 40; seed += 1) {
    const g = createRedLight(seed, seats.map((x) => ({ ...x, botSkill: 0.3 })));
    while (!g.over) stepRedLight(g, [null, null, null, null], 1000 / 60);
    games += 1;
    blown += g.runners.filter((r) => !r.alive).length;
  }
  assert.ok(blown > games * 0.4, 'slow bots do get blown up');
  assert.ok(blown < games * 4, 'but not always');
});
