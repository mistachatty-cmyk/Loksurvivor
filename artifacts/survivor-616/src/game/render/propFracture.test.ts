import assert from 'node:assert/strict';
import { test } from 'node:test';
import { propPieces, PROP_FRACTURE_LINGER_MS } from './propFracture';

test('prop fragments cover the actual artwork exactly at every material and quality', () => {
  for (const material of ['wood', 'metal', 'stone', 'glass', 'organic'] as const) {
    let previous = 0;
    for (const quality of ['performance', 'balanced', 'high'] as const) {
      const pieces = propPieces(616, material, quality);
      const area = pieces.reduce((sum, p) => sum + Math.abs(p.points.reduce((value, a, i) => {
        const b = p.points[(i + 1) % p.points.length]!;
        return value + a[0] * b[1] - a[1] * b[0];
      }, 0)) / 2, 0);
      assert.ok(Math.abs(area - 1) < 1e-9);
      assert.ok(pieces.length >= previous && pieces.length <= 24);
      assert.deepEqual(pieces, propPieces(616, material, quality));
      previous = pieces.length;
    }
  }
  assert.ok(PROP_FRACTURE_LINGER_MS >= 2000, 'pieces have time to land before fading');
});
