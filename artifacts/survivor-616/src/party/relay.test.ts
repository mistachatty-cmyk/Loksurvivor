import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RELAY, createRelay, relayResults, stepRelay, teamOrder, type RelayState } from './relay';

const bots = (skills: number[]) => skills.map((botSkill, i) => ({ characterId: `c${i}`, bot: true, botSkill }));
const idle = { keys: { x: 0, y: 0 }, aim: null, holding: false, tap: null, action: false };
const run = (s: RelayState) => {
  const seen = new Set<string>();
  while (!s.over) {
    stepRelay(s, s.runners.map(() => null), 1000 / 60);
    for (const e of s.events) seen.add(e.type);
  }
  return seen;
};

test('a match replays exactly from its seed', () => {
  const a = createRelay(6, bots([0.4, 0.6, 0.8, 0.9]));
  const b = createRelay(6, bots([0.4, 0.6, 0.8, 0.9]));
  run(a);
  run(b);
  assert.deepEqual(relayResults(a), relayResults(b));
});

test('both teams finish, pass the baton, jump and stumble', () => {
  const seen = new Set<string>();
  for (const seed of [1, 2, 3, 4, 5]) for (const e of run(createRelay(seed, bots([0.3, 0.9, 0.5, 0.5])))) seen.add(e);
  for (const t of ['jump', 'land', 'pass', 'finish', 'clear', 'stumble']) assert.ok(seen.has(t), t);
});

test('the better team wins most races', () => {
  let strongWins = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const s = createRelay(seed, bots([0.95, 0.1, 0.95, 0.1]));
    run(s);
    if (teamOrder(s)[0] === 0) strongWins++;
  }
  assert.ok(strongWins >= 16, `${strongWins}/20`);
});

test('results give both teammates the same side of the table', () => {
  const s = createRelay(3, bots([0.6, 0.6, 0.6, 0.6]));
  run(s);
  const res = relayResults(s);
  assert.deepEqual(res.map((r) => r.placement), [1, 2, 3, 4]);
  const winners = new Set(res.slice(0, 2).map((r) => r.index % 2));
  assert.equal(winners.size, 1, 'top two are teammates');
});

test('a human tap jumps; missing a gap makes you stumble back', () => {
  const s = createRelay(2, [{ characterId: 'h', bot: false }, ...bots([0.5, 0.5, 0.5])]);
  const t = s.teams[0];
  const gap = s.obstacles.find((o) => o.kind === 'gap')!;
  t.x = gap.x - 3;
  stepRelay(s, [null, null, null, null], 16);
  stepRelay(s, [null, null, null, null], 16);
  assert.ok(s.now < t.stumbleUntil, 'fell in the gap');
  assert.ok(t.stumbles >= 1);
  const s2 = createRelay(2, [{ characterId: 'h', bot: false }, ...bots([0.5, 0.5, 0.5])]);
  const g2 = s2.obstacles.find((o) => o.kind === 'gap')!;
  s2.teams[0].x = g2.x - 70;
  stepRelay(s2, [{ ...idle, tap: { x: 0, y: 0 } }, null, null, null], 16);
  assert.ok(s2.now < s2.teams[0].jumpUntil, 'jumped');
  for (let i = 0; i < 40; i++) stepRelay(s2, [null, null, null, null], 16);
  assert.equal(s2.teams[0].stumbles, 0, 'cleared the gap');
  assert.ok(RELAY.jumpMs > 0);
});

test('the baton passes at the half-way line, with a turbo for a clean leg', () => {
  const s = createRelay(1, bots([0.5, 0.5, 0.5, 0.5]));
  s.obstacles = [];
  const t = s.teams[0];
  t.x = RELAY.length / 2 - 1;
  stepRelay(s, [null, null, null, null], 16);
  assert.equal(t.leg, 1);
  assert.ok(s.now < t.turboUntil);
});
