import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RUMBLE, createRoofRumble, rumbleRadius, rumbleResults, stepRoofRumble, type RumbleState } from './roofRumble';

const bots = (skills: number[]) => skills.map((botSkill, i) => ({ characterId: `c${i}`, bot: true, botSkill }));
const run = (s: RumbleState) => {
  const seen = new Set<string>();
  while (!s.over) {
    stepRoofRumble(s, s.runners.map(() => null), 1000 / 60);
    for (const e of s.events) seen.add(e.type);
  }
  return seen;
};

test('a match replays exactly from its seed', () => {
  const a = createRoofRumble(9, bots([0.4, 0.6, 0.8, 0.9]));
  const b = createRoofRumble(9, bots([0.4, 0.6, 0.8, 0.9]));
  run(a);
  run(b);
  assert.deepEqual(rumbleResults(a), rumbleResults(b));
});

test('bots actually fight: shoves, falls, knockouts and barrel blasts happen', () => {
  const seen = new Set<string>();
  let kos = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const s = createRoofRumble(seed, bots([0.5, 0.7, 0.8, 0.9]));
    for (const type of run(s)) seen.add(type);
    kos += s.runners.reduce((n, r) => n + r.kos, 0);
  }
  for (const type of ['dash', 'bump', 'fall', 'ko', 'boom', 'land', 'crumble']) assert.ok(seen.has(type), type);
  assert.ok(kos >= 12, `only ${kos} knockouts in 12 matches`);
});

test('the roof shrinks on schedule', () => {
  assert.equal(rumbleRadius(0), RUMBLE.radius);
  assert.equal(rumbleRadius(RUMBLE.shrinkToMs + 1), RUMBLE.minRadius);
  assert.ok(rumbleRadius(16_000) < RUMBLE.radius && rumbleRadius(16_000) > RUMBLE.minRadius);
});

test('a dash into a rival shoves them off, credits the knockout, and they drop back in', () => {
  const s = createRoofRumble(1, [{ characterId: 'me', bot: false }, { characterId: 'them', bot: false }]);
  const [me, them] = s.runners;
  Object.assign(me, { x: 200, y: 0 });
  Object.assign(them, { x: 262, y: 0 });
  s.nextBarrelAt = 1e9;
  const tap = { keys: { x: 0, y: 0 }, aim: null, holding: false, tap: { x: 300, y: 0 }, action: false };
  stepRoofRumble(s, [tap, null], 1000 / 60);
  for (let i = 0; i < 60 && !them.fallingSince; i++) stepRoofRumble(s, [null, null], 1000 / 60);
  assert.ok(them.fallingSince > 0, 'rival went over the edge');
  assert.equal(me.kos, 1);
  assert.equal(me.score, RUMBLE.points.ko);
  assert.equal(them.falls, 1);
  for (let i = 0; i < 150; i++) stepRoofRumble(s, [null, null], 1000 / 60);
  assert.equal(them.fallingSince, 0);
  assert.ok(Math.hypot(them.x, them.y) < s.radius, 'back on the roof');
});

test('a barrel blast throws everyone near it outward', () => {
  const s = createRoofRumble(2, [{ characterId: 'a', bot: false }, { characterId: 'b', bot: false }]);
  s.nextBarrelAt = 1e9;
  s.barrels.push({ id: 1, x: 0, y: 0, landAt: 0, fuseAt: 1, landed: true, gone: false });
  Object.assign(s.runners[0], { x: -60, y: 0 });
  Object.assign(s.runners[1], { x: 60, y: 0 });
  stepRoofRumble(s, [null, null], 1000 / 60);
  assert.ok(s.events.some((e) => e.type === 'boom'));
  assert.ok(s.runners[0].vx < -500 && s.runners[1].vx > 500);
});
