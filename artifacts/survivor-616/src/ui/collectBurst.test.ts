import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BURST_FLIGHT_MS, pieceCountFor, planBurst, playCollectBurst } from './collectBurst';

test('piece count grows with the reward and stays between 3 and 12', () => {
  assert.equal(pieceCountFor(0), 3);
  assert.equal(pieceCountFor(1), 3);
  assert.ok(pieceCountFor(30) > pieceCountFor(2));
  assert.equal(pieceCountFor(10_000_000), 12);
});

test('power save never uses more than 4 pieces', () => {
  assert.equal(pieceCountFor(10_000_000, true), 4);
  assert.equal(pieceCountFor(1, true), 3);
});

test('the same seed plans the same burst, another seed differs', () => {
  const a = planBurst({ amount: 40, seed: 7 });
  assert.deepEqual(a, planBurst({ amount: 40, seed: 7 }));
  assert.notDeepEqual(a.pieces, planBurst({ amount: 40, seed: 8 }).pieces);
});

test('pieces are staggered and the total time covers the last piece landing', () => {
  const plan = planBurst({ amount: 100, seed: 1 });
  assert.equal(plan.totalMs, BURST_FLIGHT_MS + (plan.pieces.length - 1) * 45);
  assert.deepEqual(plan.pieces.map((p) => p.delayMs), plan.pieces.map((_, i) => i * 45));
  for (const p of plan.pieces) assert.ok(Math.hypot(p.dx, p.dy + 24) >= 36 - 1e-9 && Math.hypot(p.dx, p.dy + 24) <= 90 + 1e-9);
});

test('reduced motion or a missing target skips the show and still reports everything landed', () => {
  for (const o of [{ reducedMotion: true }, { reducedMotion: false }]) {
    const seen: Array<[number, number]> = [];
    let done = 0;
    const cancel = playCollectBurst({ from: null, to: null, amount: 30, ...o, onLand: (l, t) => seen.push([l, t]), onDone: () => { done += 1; } });
    cancel();
    assert.equal(done, 1);
    assert.equal(seen.length, 1);
    assert.equal(seen[0]![0], seen[0]![1]);
  }
});
