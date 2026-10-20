import assert from 'node:assert/strict';
import test from 'node:test';

import { getEnemy } from '@/game/data/enemies';
import { HordeField, HORDE_BLOCK } from '@/game/engine/hordeField';

const view = (px = 0, py = 0) => ({ px, py, hold: 600, ky: 1, drawHalfW: 700, drawHalfH: 500 });

test('HordeField stores members as flat arrays and never exceeds capacity', () => {
  const field = new HordeField(5000);
  const kind = field.registerKind(getEnemy('nightcrawler'), 1, 90);
  assert.equal(field.addBatch(kind, 4000, 1000, 0, 300, 300, 7, 0), 4000);
  assert.equal(field.addBatch(kind, 4000, 1000, 0, 300, 300, 8, 0), 1000, 'only the remaining room is filled');
  assert.equal(field.count, 5000);
  assert.equal(field.addBatch(kind, 1, 0, 0, 1, 1, 9, 0), 0);
});

test('HordeField scatter is deterministic per seed and spread across the area', () => {
  const a = new HordeField(2048);
  const b = new HordeField(2048);
  const ka = a.registerKind(getEnemy('nightcrawler'), 1, 90);
  const kb = b.registerKind(getEnemy('nightcrawler'), 1, 90);
  a.addBatch(ka, 1500, 500, 500, 200, 200, 42, 0);
  b.addBatch(kb, 1500, 500, 500, 200, 200, 42, 0);
  assert.deepEqual(Array.from(a.x.slice(0, 1500)), Array.from(b.x.slice(0, 1500)));
  let minX = Infinity, maxX = -Infinity;
  for (let i = 0; i < 1500; i += 1) { minX = Math.min(minX, a.x[i]!); maxX = Math.max(maxX, a.x[i]!); }
  assert.ok(minX >= 400 && maxX <= 600 && maxX - minX > 150);
});

test('HordeField.removeAt keeps the array dense', () => {
  const field = new HordeField(2048);
  const kind = field.registerKind(getEnemy('nightcrawler'), 1, 90);
  field.addBatch(kind, 10, 0, 0, 100, 100, 1, 0);
  const lastX = field.x[9]!;
  field.removeAt(2);
  assert.equal(field.count, 9);
  assert.equal(field.x[2], lastX, 'the last member fills the hole');
  field.removeAt(50);
  assert.equal(field.count, 9, 'out-of-range removal is ignored');
});

test('HordeField.sweep costs a fixed budget regardless of population and walks members to the shell', () => {
  const small = new HordeField(HORDE_BLOCK * 300);
  const large = new HordeField(HORDE_BLOCK * 300);
  const ks = small.registerKind(getEnemy('nightcrawler'), 1, 400);
  const kl = large.registerKind(getEnemy('nightcrawler'), 1, 400);
  small.addBatch(ks, HORDE_BLOCK * 4, 2000, 0, 400, 400, 1, 0);
  large.addBatch(kl, HORDE_BLOCK * 300, 2000, 0, 400, 400, 1, 0);
  const budget = HORDE_BLOCK * 4;
  // One sweep touches only `budget` members, however many exist.
  large.sweep(1000, view(), budget);
  let moved = 0;
  for (let i = budget; i < large.count; i += 1) if (large.x[i]! < 1700) moved += 1;
  assert.equal(moved, 0, 'members outside the first budgeted blocks have not been visited yet');
  assert.ok(large.x[0]! < 2000 && large.x[0]! > 1000, 'visited members stride toward the player');

  for (let t = 1; t <= 40; t += 1) small.sweep(1000 + t * 1000, view(), budget);
  for (let i = 0; i < small.count; i += 1) {
    const d = Math.hypot(small.x[i]!, small.y[i]!);
    assert.ok(d >= 559, `member ${i} stopped inside the hold radius (${d.toFixed(1)})`);
    assert.ok(d <= 600 + small.shellDepth(600) + 42, `member ${i} never reached the shell (${d.toFixed(1)})`);
  }
  assert.ok(small.candidateCount > 0, 'arrived members are offered for promotion');
});
