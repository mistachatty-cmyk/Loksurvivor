import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PropTextureCache } from './propTextureCache';

test('25 damaged props do not rebuild all 25 snapshots every frame in a 24-entry cache', () => {
  const cache = new PropTextureCache<object>();
  let paints = 0;
  for (const now of [0, 16, 32]) {
    for (let prop = 0; prop < 25; prop += 1) cache.getOrCreate(`${prop}`, now, () => { paints += 1; return {}; });
  }
  assert.equal(paints, 27, 'only the overflow prop is repainted after the first frame');
  assert.equal(cache.size, 24);
});

test('props leaving the view free a cold slot, and a new run cannot reuse old actor artwork', () => {
  const cache = new PropTextureCache<object>(2, 250);
  const first = cache.getOrCreate('a', 0, () => ({}));
  cache.getOrCreate('b', 0, () => ({}));
  const next = cache.getOrCreate('c', 300, () => ({}));
  assert.equal(cache.getOrCreate('c', 316, () => { throw Error('should stay cached'); }), next);
  assert.equal(cache.size, 2);
  const restarted = cache.getOrCreate('a', 0, () => ({}));
  assert.notEqual(restarted, first);
  assert.equal(cache.size, 1);
});
