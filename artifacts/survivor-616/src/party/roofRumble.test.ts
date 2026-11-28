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

test('Roof Collapse: rings crack, then drop one at a time, and bots mostly step off in time', () => {
  const s = createRoofRumble(4, bots([0.6, 0.7, 0.8, 0.9]), 'collapse');
  const seen: string[] = [];
  let caught = 0;
  while (!s.over) {
    stepRoofRumble(s, [null, null, null, null], 1000 / 60);
    for (const e of s.events) {
      if (e.type === 'ringWarn' || e.type === 'ringDrop') seen.push(`${e.type}:${e.outer}`);
      if (e.type === 'fall' && RUMBLE.ringDropAt.some((at) => Math.abs(s.now - at) < 50)) caught++;
    }
  }
  assert.deepEqual(seen, ['ringWarn:330', 'ringDrop:330', 'ringWarn:245', 'ringDrop:245', 'ringWarn:165', 'ringDrop:165']);
  assert.equal(s.radius, RUMBLE.rings[3]);
  assert.ok(caught <= 3, `${caught} bots rode a ring down`);
});

test('clutch save: dash back inward while teetering over the edge and you stay on', () => {
  const s = createRoofRumble(3, [{ characterId: 'me', bot: false }]);
  s.nextBarrelAt = 1e9;
  const me = s.runners[0];
  Object.assign(me, { x: RUMBLE.radius + 20, y: 0, vx: 300 });
  const none = { keys: { x: 0, y: 0 }, aim: null, holding: false, tap: null, action: false };
  stepRoofRumble(s, [none], 1000 / 60);
  assert.ok(me.teeterUntil > 0, 'teetering');
  stepRoofRumble(s, [{ ...none, keys: { x: -1, y: 0 }, action: true }], 1000 / 60);
  for (let i = 0; i < 20; i++) stepRoofRumble(s, [none], 1000 / 60);
  assert.equal(me.fallingSince, 0);
  assert.equal(me.falls, 0);
  assert.equal(me.score, RUMBLE.points.clutch);
});

test('no dash over the edge means a fall once coyote time runs out', () => {
  const s = createRoofRumble(3, [{ characterId: 'me', bot: false }]);
  s.nextBarrelAt = 1e9;
  Object.assign(s.runners[0], { x: RUMBLE.radius + 20, y: 0, vx: 300 });
  for (let i = 0; i < 30; i++) stepRoofRumble(s, [null], 1000 / 60);
  assert.equal(s.runners[0].falls, 1);
});

test('a dash pressed just before the cooldown ends still fires', () => {
  const s = createRoofRumble(3, [{ characterId: 'me', bot: false }]);
  s.nextBarrelAt = 1e9;
  const me = s.runners[0];
  Object.assign(me, { x: 0, y: 0 });
  const press = { keys: { x: 1, y: 0 }, aim: null, holding: false, tap: null, action: true };
  stepRoofRumble(s, [press], 1000 / 60);
  const first = me.dashReadyAt;
  while (s.now < first - 100) stepRoofRumble(s, [null], 1000 / 60);
  stepRoofRumble(s, [press], 1000 / 60);
  while (s.now < first + 20) stepRoofRumble(s, [null], 1000 / 60);
  assert.ok(me.dashReadyAt > first, 'buffered dash fired');
});

test('Tilting Deck: the lean pushes runners, turns on a schedule and stays seeded', async () => {
  const { TILT, tiltAt } = await import('./roofRumble');
  const a = createRoofRumble(4, bots([0.5, 0.6, 0.7, 0.8]), 'tilt');
  const b = createRoofRumble(4, bots([0.5, 0.6, 0.7, 0.8]), 'tilt');
  const seen = run(a);
  run(b);
  assert.deepEqual(rumbleResults(a), rumbleResults(b));
  assert.ok(seen.has('tiltTurn') && seen.has('tiltWarn') && seen.has('fall'), [...seen].join(','));
  assert.equal(rumbleRadius(20000, 'tilt'), TILT.radius);
  assert.ok(tiltAt(TILT.segMs * 3).power > tiltAt(0).power);
  // An idle runner on the deck slides toward the lean.
  const s = createRoofRumble(1, [{ characterId: 'x', bot: false }], 'tilt');
  s.barrels = [];
  s.nextBarrelAt = 1e9;
  const r = s.runners[0];
  r.x = 0;
  r.y = 0;
  for (let i = 0; i < 40; i++) stepRoofRumble(s, [null], 16);
  const lean = tiltAt(s.now);
  assert.ok(r.x * lean.dx + r.y * lean.dy > 5, 'slid downhill');
});
