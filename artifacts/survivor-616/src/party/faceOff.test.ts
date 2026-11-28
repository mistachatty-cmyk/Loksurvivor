import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FACE, PROMPTS, createFaceOff, faceResults, guideFor, roundScore, stepFaceOff, targetOf, type FaceState } from './faceOff';

const bots = (skills: number[]) => skills.map((botSkill, i) => ({ characterId: `c${i}`, bot: true, botSkill }));
const run = (s: FaceState) => {
  const seen = new Set<string>();
  while (!s.over) {
    stepFaceOff(s, s.runners.map(() => null), 1000 / 60);
    for (const e of s.events) seen.add(e.type);
  }
  return seen;
};

test('a match replays exactly from its seed', () => {
  const a = createFaceOff(8, bots([0.3, 0.5, 0.7, 0.9]));
  const b = createFaceOff(8, bots([0.3, 0.5, 0.7, 0.9]));
  run(a);
  run(b);
  assert.deepEqual(faceResults(a), faceResults(b));
  assert.equal(a.prompts.length, FACE.rounds);
  assert.equal(new Set(a.prompts).size, FACE.rounds);
});

test('every prompt has a guide and a target of sensible size', () => {
  for (const p of PROMPTS) {
    assert.ok(guideFor(p).length > 0);
    const t = targetOf(p);
    assert.ok(t.count > 40 && t.count < 700, `${p}: ${t.count}`);
  }
});

test('better bots draw better, and scores stay within 0 to 100 a round', () => {
  let strong = 0;
  let weak = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const s = createFaceOff(seed, bots([0.95, 0.1, 0.5, 0.5]));
    const seen = run(s);
    assert.ok(seen.has('reveal') && seen.has('scored'));
    for (const r of s.runners) for (const v of r.roundScores) assert.ok(v >= 0 && v <= FACE.maxPoints);
    strong += s.runners[0].score;
    weak += s.runners[1].score;
  }
  assert.ok(strong > weak + 100, `${strong} vs ${weak}`);
});

test('a human tracing the guide scores high; scribbling everywhere scores low', () => {
  const s = createFaceOff(3, [{ characterId: 'h', bot: false }, ...bots([0.5, 0.5, 0.5])]);
  const me = s.runners[0];
  const g = guideFor(s.prompts[0]);
  let n = 0;
  for (const line of g)
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i];
      const b = line[i + 1];
      for (let k = 0; k <= 8; k++) {
        n++;
        stepFaceOff(s, [{ keys: { x: 0, y: 0 }, aim: { x: a.x + ((b.x - a.x) * k) / 8, y: a.y + ((b.y - a.y) * k) / 8 }, holding: true, tap: null, action: false }, null, null, null], 4);
      }
    }
  assert.ok(n > 10);
  const traced = roundScore(me, s.prompts[0]);
  assert.ok(traced >= 80, `traced ${traced}`);
  const scribble = createFaceOff(3, [{ characterId: 'h', bot: false }, ...bots([0.5, 0.5, 0.5])]);
  for (let y = -190; y <= 190; y += 6)
    for (let x = -170; x <= 170; x += 12)
      stepFaceOff(scribble, [{ keys: { x: 0, y: 0 }, aim: { x, y }, holding: true, tap: null, action: false }, null, null, null], 1);
  assert.ok(roundScore(scribble.runners[0], scribble.prompts[0]) < 40);
});

test('keyboard steering draws too', () => {
  const s = createFaceOff(3, [{ characterId: 'h', bot: false }, ...bots([0.5, 0.5, 0.5])]);
  for (let i = 0; i < 30; i++) stepFaceOff(s, [{ keys: { x: 1, y: 0 }, aim: null, holding: false, tap: null, action: false }, null, null, null], 16);
  assert.ok(s.runners[0].strokes.length > 0 && s.runners[0].pen.x > 50);
});
