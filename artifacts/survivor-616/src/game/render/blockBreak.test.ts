import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BLOCK_FX_LINGER_MS, blockMaterialOf, buildCrackNetwork, shardTiling } from './blockBreak';

const triArea = (t: readonly number[]) => Math.abs((t[0]! * (t[3]! - t[5]!) + t[2]! * (t[5]! - t[1]!) + t[4]! * (t[1]! - t[3]!)) / 2);

test('only glass and ice blocks use the block material renderer', () => {
  assert.equal(blockMaterialOf('glass-block'), 'glass');
  assert.equal(blockMaterialOf('ice-block'), 'ice');
  assert.equal(blockMaterialOf('crate'), undefined);
  assert.ok(BLOCK_FX_LINGER_MS > 760, 'shards linger longer than ordinary props');
});

test('shard tilings cover the whole block with no gaps or overlaps', () => {
  for (const [gx, gy] of [[3, 2], [4, 3], [5, 4]] as const) {
    for (const seed of [1, 7, 4242]) {
      const tris = shardTiling(seed, gx, gy);
      assert.equal(tris.length, gx * gy * 2);
      const area = tris.reduce((sum, t) => sum + triArea(t), 0);
      assert.ok(Math.abs(area - 1) < 1e-9, `area ${area} for ${gx}x${gy} seed ${seed}`);
    }
  }
});

test('a block always breaks the same way for the same seed, and differently for another', () => {
  assert.deepEqual(shardTiling(9, 4, 3), shardTiling(9, 4, 3));
  assert.notDeepEqual(shardTiling(9, 4, 3), shardTiling(10, 4, 3));
  assert.deepEqual(buildCrackNetwork(5, 'glass', 0.1, -0.1), buildCrackNetwork(5, 'glass', 0.1, -0.1));
  assert.notDeepEqual(buildCrackNetwork(5, 'glass', 0.1, -0.1), buildCrackNetwork(6, 'glass', 0.1, -0.1));
});

test('crack networks have all three layers, grow outward from the hit point, and order within 0..1', () => {
  for (const material of ['glass', 'ice'] as const) {
    const segs = buildCrackNetwork(33, material, 0.05, 0.02);
    const layers = new Set(segs.map((s) => s.layer));
    assert.ok(layers.has(0) && layers.has(1), `${material} has fractures and branches`);
    assert.ok(segs.length > 25, `${material} crack network is detailed (${segs.length} segments)`);
    for (const s of segs) assert.ok(s.order > 0 && s.order <= 1, `order ${s.order}`);
    // The earliest-appearing segments start at the impact point.
    const first = segs.filter((s) => s.layer === 0 && s.order <= 0.34).slice(0, 3);
    assert.ok(first.some((s) => Math.hypot(s.x0 - 0.05, s.y0 - 0.02) < 0.01));
  }
  const glass = buildCrackNetwork(33, 'glass', 0, 0);
  assert.ok(glass.some((s) => s.layer === 1), 'glass grows spider-web rings');
});
