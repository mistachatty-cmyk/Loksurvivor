import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POSE, TILE_CENTERS, createStrikePose, dirToPose, poseResults, roundPhase, stepStrikePose, tileAt, type PoseState } from './strikePose';

const bots = (skills: number[]) => skills.map((botSkill, i) => ({ characterId: `c${i}`, bot: true, botSkill }));
const run = (s: PoseState) => {
  const seen = new Set<string>();
  while (!s.over) {
    stepStrikePose(s, s.runners.map(() => null), 1000 / 60);
    for (const e of s.events) seen.add(e.type);
  }
  return seen;
};
const idle = { keys: { x: 0, y: 0 }, aim: null, holding: false, tap: null, action: false };

test('a match replays exactly from its seed', () => {
  const a = createStrikePose(11, bots([0.3, 0.5, 0.7, 0.9]));
  const b = createStrikePose(11, bots([0.3, 0.5, 0.7, 0.9]));
  run(a);
  run(b);
  assert.deepEqual(poseResults(a), poseResults(b));
});

test('a full match has right and wrong answers and lasts eight rounds', () => {
  const seen = new Set<string>();
  const s = createStrikePose(2, bots([0.2, 0.4, 0.6, 0.9]));
  for (const e of run(s)) seen.add(e);
  for (const t of ['show', 'right', 'reveal', 'hide']) assert.ok(seen.has(t), t);
  assert.equal(s.round, POSE.rounds - 1);
  assert.equal(s.now >= POSE.rounds * POSE.roundMs, true);
});

test('faster and better bots win more often', () => {
  let strong = 0;
  let weak = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const s = createStrikePose(seed, bots([0.95, 0.15, 0.15, 0.15]));
    run(s);
    strong += s.runners[0].score;
    weak += s.runners[1].score;
  }
  assert.ok(strong > weak * 1.5, `${strong} vs ${weak}`);
});

test('first, second and third right get 3, 2 and 1 and a double round doubles it', () => {
  const s = createStrikePose(1, bots([0.5, 0.5, 0.5, 0.5]));
  for (const r of s.runners) r.botAt = 1e9;
  s.now = POSE.readyMs + 10;
  const right = s.poses[0];
  const human = (i: number) => {
    s.runners[i].bot = false;
    const c = TILE_CENTERS[right];
    const inputs = s.runners.map((_, k) => (k === i ? { ...idle, tap: { x: c.x, y: c.y } } : null));
    stepStrikePose(s, inputs, 1);
  };
  human(0); human(1); human(2);
  assert.deepEqual(s.runners.slice(0, 3).map((r) => r.score), [3, 2, 1]);
  s.kinds[0] = 'double';
  human(3);
  assert.equal(s.runners[3].score, 0 + 1 * 2);
});

test('a wrong pose costs a point (never below zero) and locks you out briefly', () => {
  const s = createStrikePose(1, bots([0.5, 0.5, 0.5, 0.5]));
  for (const r of s.runners) r.botAt = 1e9;
  s.now = POSE.readyMs + 10;
  const r = s.runners[0];
  r.bot = false;
  r.score = 2;
  const wrong = TILE_CENTERS[(s.poses[0] + 1) % 4];
  stepStrikePose(s, [{ ...idle, tap: { x: wrong.x, y: wrong.y } }, null, null, null], 1);
  assert.equal(r.score, 1);
  const right = TILE_CENTERS[s.poses[0]];
  stepStrikePose(s, [{ ...idle, tap: { x: right.x, y: right.y } }, null, null, null], 1);
  assert.equal(r.pick, -1, 'locked out');
  assert.equal(roundPhase(s), 'go');
});

test('tiles and stick directions map to the same four poses', () => {
  assert.deepEqual([0, 1, 2, 3].map((i) => tileAt(TILE_CENTERS[i].x, TILE_CENTERS[i].y)), [0, 1, 2, 3]);
  assert.equal(tileAt(400, 400), -1);
  assert.deepEqual([dirToPose(0, -1), dirToPose(-1, 0), dirToPose(1, 0), dirToPose(0, 1), dirToPose(0.1, 0.1)], [0, 1, 2, 3, -1]);
});
