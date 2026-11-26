import assert from 'node:assert/strict';
import test from 'node:test';

import { generateChunk } from '@/game/engine/chunks';
import { CHARACTERS_BY_ID } from '@/game/data/characters';

test('endless chunks place boulders deterministically and not too often', () => {
  const a: string[] = [];
  const b: string[] = [];
  let total = 0;
  for (let cx = -6; cx <= 6; cx += 1) {
    for (let cy = -6; cy <= 6; cy += 1) {
      const first = generateChunk(cx, cy, 1234);
      const second = generateChunk(cx, cy, 1234);
      for (const o of first.obstacles) {
        total += 1;
        if (o.kind === 'boulder' || o.kind === 'boulder-crumbler') a.push(`${cx},${cy},${o.kind},${Math.round(o.x)},${Math.round(o.y)}`);
      }
      for (const o of second.obstacles) {
        if (o.kind === 'boulder' || o.kind === 'boulder-crumbler') b.push(`${cx},${cy},${o.kind},${Math.round(o.x)},${Math.round(o.y)}`);
      }
    }
  }
  assert.ok(a.length > 0, 'some boulders should appear across 169 chunks');
  assert.deepEqual(a, b, 'the same seed must give the same boulders');
  assert.ok(a.length / total < 0.08, 'boulders stay a rare sight');
  assert.ok(a.some((s) => s.includes('boulder-crumbler')) && a.some((s) => s.includes(',boulder,')), 'both versions appear');
});

test('Street Life characters are registered and use real power states', () => {
  assert.equal(CHARACTERS_BY_ID['golden-hour']?.ultimatePowerState, 'gilded');
  assert.equal(CHARACTERS_BY_ID['quarry-kid']?.ultimatePowerState, 'supersonic');
  assert.ok(CHARACTERS_BY_ID['lost-and-found-lou']?.lokPetCollector);
});
