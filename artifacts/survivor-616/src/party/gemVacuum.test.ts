import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GEMS, createGemVacuum, gemResults, padCenter, stepGemVacuum, type GemState } from './gemVacuum';

const bots = (skills: number[]) => skills.map((botSkill, i) => ({ characterId: `c${i}`, bot: true, botSkill }));
const run = (s: GemState) => {
  const seen = new Set<string>();
  while (!s.over) {
    stepGemVacuum(s, s.runners.map(() => null), 1000 / 60);
    for (const e of s.events) seen.add(e.type);
  }
  return seen;
};

test('a match replays exactly from its seed', () => {
  const a = createGemVacuum(5, bots([0.3, 0.5, 0.7, 0.9]));
  const b = createGemVacuum(5, bots([0.3, 0.5, 0.7, 0.9]));
  run(a);
  run(b);
  assert.deepEqual(gemResults(a), gemResults(b));
});

test('bots bank gems, dash into each other, and the frenzy starts', () => {
  const seen = new Set<string>();
  for (const seed of [1, 2, 3, 4]) for (const e of run(createGemVacuum(seed, bots([0.4, 0.6, 0.8, 0.9])))) seen.add(e);
  for (const t of ['bank', 'pick', 'boost', 'frenzy']) assert.ok(seen.has(t), `no ${t} event`);
});

test('every runner scores something and placements are 1 to 4', () => {
  const s = createGemVacuum(7, bots([0.5, 0.5, 0.5, 0.5]));
  run(s);
  const res = gemResults(s);
  assert.deepEqual(res.map((r) => r.placement), [1, 2, 3, 4]);
  assert.ok(s.runners.every((r) => r.banked > 0), 'someone banked nothing');
});

test('carried gems only count once banked on your own pad', () => {
  const s = createGemVacuum(3, bots([0.5, 0.5, 0.5, 0.5]));
  s.gems = [];
  const r = s.runners[0];
  r.carry = 5;
  r.x = 0;
  r.y = 0;
  stepGemVacuum(s, [null, null, null, null], 16);
  assert.equal(r.banked, 0);
  const p = padCenter(0);
  r.x = p.x;
  r.y = p.y;
  r.stunUntil = 0;
  stepGemVacuum(s, [null, null, null, null], 16);
  assert.equal(r.banked, 5);
  assert.equal(r.carry, 0);
});

test('a dash into a loaded rival spills half their load', () => {
  const s = createGemVacuum(3, bots([0, 0, 0, 0]));
  s.gems = [];
  const [a, b] = s.runners;
  a.x = 0; a.y = 0; b.x = 30; b.y = 0; b.carry = 10;
  a.boostUntil = s.now + 500;
  stepGemVacuum(s, [null, null, null, null], 16);
  assert.ok(b.carry <= 5, `carry ${b.carry}`);
  assert.ok(a.steals >= 5);
});

test('human input moves and dashes', () => {
  const s = createGemVacuum(3, [{ characterId: 'h', bot: false }, ...bots([0.5, 0.5, 0.5])]);
  s.gems = [];
  const r = s.runners[0];
  const x0 = r.x;
  for (let i = 0; i < 20; i++) stepGemVacuum(s, [{ keys: { x: 1, y: 0 }, aim: null, holding: false, tap: null, action: false }, null, null, null], 16);
  assert.ok(r.x > x0 + 20);
  stepGemVacuum(s, [{ keys: { x: 1, y: 0 }, aim: null, holding: false, tap: null, action: true }, null, null, null], 16);
  assert.ok(s.now < r.boostUntil);
  assert.ok(GEMS.boostCooldownMs > GEMS.boostMs);
});
