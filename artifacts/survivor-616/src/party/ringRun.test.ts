import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { RUSH, createRingRun, piecesBetween, rushPerformance, rushResults, stepRingRun, trackChunk, type RushInput } from './ringRun';
import { DEFAULT_PREFS, actionForKey, nextMode, padActions, sanitizePrefs } from '../lib/lokInput/core';

const STEP = 1000 / 60;
const roster = [
  { characterId: 'zero-day', bot: false },
  { characterId: 'shade', bot: true, botSkill: 0.8 },
  { characterId: 'quarry-kid', bot: true, botSkill: 0.5 },
  { characterId: 'golden-hour', bot: true, botSkill: 0.2 },
];

function runAll(seed: number, human: (t: number) => RushInput | null = () => null) {
  const s = createRingRun(seed, roster);
  while (!s.over) stepRingRun(s, [human(s.now), null, null, null], STEP);
  return s;
}

test('the street is a pure function of the seed and leaves the start clear', () => {
  assert.deepEqual(trackChunk(616, 3), trackChunk(616, 3));
  assert.notDeepEqual(trackChunk(616, 3), trackChunk(617, 3));
  const s = createRingRun(1, roster);
  assert.ok(piecesBetween(s, 0, RUSH.startGap - 1).length === 0);
  for (let c = 0; c < 40; c += 1) for (const p of trackChunk(9, c)) assert.ok(p.lane >= 0 && p.lane <= 2);
});

test('a whole match is deterministic: same seed, same results, bots never touch shared rng', () => {
  const a = rushResults(runAll(77));
  const b = rushResults(runAll(77));
  assert.deepEqual(a, b);
  assert.deepEqual(a.map((r) => r.placement).sort(), [1, 2, 3, 4]);
  const orig = Math.random;
  Math.random = () => {
    throw new Error('ringRun must not use Math.random');
  };
  try {
    runAll(5);
  } finally {
    Math.random = orig;
  }
});

test('rings build a chain, rocks break it, and a jump clears a rock', () => {
  const s = createRingRun(3, [roster[0]]);
  const p = s.players[0];
  // Hand-place a clean line of rings in lane 1, then a rock.
  s.chunks.set(0, [
    { id: 1, x: 300, lane: 1, kind: 'ring' },
    { id: 2, x: 340, lane: 1, kind: 'ring' },
    { id: 3, x: 380, lane: 1, kind: 'ring' },
    { id: 4, x: 420, lane: 1, kind: 'ring' },
    { id: 5, x: 520, lane: 1, kind: 'rock' },
  ]);
  for (let i = 0; i < 400 && p.dist < 480; i += 1) stepRingRun(s, [null], STEP);
  assert.equal(p.rings, 4);
  assert.equal(p.mult, 2, 'four rings in a row raise the multiplier');
  assert.ok(p.score >= 10 * 4);
  // Drive into the rock without jumping: stun, chain broken.
  for (let i = 0; i < 200 && p.hits === 0; i += 1) stepRingRun(s, [null], STEP);
  assert.equal(p.hits, 1);
  assert.equal(p.mult, 1);
  assert.ok(s.now < p.stunUntil);
});

test('jumping over a rock avoids the hit', () => {
  const s = createRingRun(4, [roster[0]]);
  const p = s.players[0];
  s.chunks.set(0, [{ id: 1, x: 420, lane: 1, kind: 'rock' }]);
  let jumped = false;
  for (let i = 0; i < 400 && p.dist < 520; i += 1) {
    const jump = !jumped && p.dist > 330;
    if (jump) jumped = true;
    stepRingRun(s, [{ laneDelta: 0, jumpPressed: jump }], STEP);
  }
  assert.equal(p.hits, 0);
  assert.equal(p.jumps, 1);
});

test('performance maps onto the shared meta inputs', () => {
  const s = runAll(21);
  const mine = rushResults(s).find((r) => !r.bot)!;
  const perf = rushPerformance(s, mine);
  assert.equal(perf.players, 4);
  assert.ok(perf.objective >= 0 && perf.skill >= 0 && perf.skill <= 1);
  assert.equal(perf.banked, mine.banked);
});

test('lokInput: keys and pad buttons become the same actions', () => {
  assert.deepEqual(actionForKey('ArrowLeft'), { kind: 'dir', dx: -1, dy: 0 });
  assert.deepEqual(actionForKey('w'), { kind: 'dir', dx: 0, dy: -1 });
  assert.deepEqual(actionForKey(' '), { kind: 'primary' });
  assert.deepEqual(actionForKey('7'), { kind: 'num', n: 7 });
  assert.equal(actionForKey('Escape'), null, 'Esc stays with the browser so it can leave fullscreen');
  const held = new Map<string, boolean>();
  const press = (b: number) => Array.from({ length: 16 }, (_, i) => i === b);
  assert.deepEqual(padActions(press(0), [0, 0], held), [{ kind: 'primary' }]);
  assert.deepEqual(padActions(press(0), [0, 0], held), [], 'held buttons fire once');
  assert.deepEqual(padActions(press(99), [0.9, 0], held), [{ kind: 'dir', dx: 1, dy: 0 }], 'stick edge');
});

test('lokInput: modes cycle and saved prefs are sanitized', () => {
  assert.equal(nextMode('pointer'), 'keyboard');
  assert.equal(nextMode('keyboard'), 'gamepad');
  assert.equal(nextMode('gamepad'), 'pointer');
  assert.deepEqual(sanitizePrefs(null), DEFAULT_PREFS);
  const bad = sanitizePrefs({ mode: 'toaster', x: 9, y: 'no', locked: 'yes' });
  assert.equal(bad.mode, 'pointer');
  assert.ok(bad.x <= 0.97 && bad.y === DEFAULT_PREFS.y && bad.locked === false);
});

test('lokInput stays free of game imports so it can become its own package', () => {
  for (const f of ['core.ts', 'LokInputPad.tsx', 'index.ts']) {
    const src = readFileSync(fileURLToPath(new URL(`../lib/lokInput/${f}`, import.meta.url)), 'utf8');
    const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    assert.ok(imports.every((p) => p.startsWith('./') || p === 'react'), `${f} imports ${imports.join(', ')}`);
  }
});
