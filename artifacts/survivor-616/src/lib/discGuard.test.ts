import assert from 'node:assert/strict';
import { test } from 'node:test';

test('discGuard is safe to import without a browser', async () => {
  const { armDiscGuard, watchDiscGuard } = await import('./discGuard');
  assert.deepEqual(armDiscGuard(), { lite: true, off: false });
  assert.equal(typeof watchDiscGuard(), 'function');
});
