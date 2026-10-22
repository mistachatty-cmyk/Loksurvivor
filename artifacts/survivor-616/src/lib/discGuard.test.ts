import assert from 'node:assert/strict';
import { test } from 'node:test';

test('discGuard is safe to import without a browser', async () => {
  const { armDiscGuard, watchDiscGuard } = await import('./discGuard');
  assert.deepEqual(armDiscGuard(), { lite: true, off: false });
  assert.equal(typeof watchDiscGuard(), 'function');
});

test('judgeVisit counts a dirty last visit and lets old strikes expire', async () => {
  const { judgeVisit, STRIKE_EXPIRY_MS } = await import('./discGuard');
  const now = 10 * STRIKE_EXPIRY_MS;
  assert.equal(judgeVisit(false, 0, null, now), 0);
  assert.equal(judgeVisit(true, 0, null, now), 1);
  assert.equal(judgeVisit(true, 1, now - 1000, now), 2);
  assert.equal(judgeVisit(false, 2, now - 1000, now), 2);
  assert.equal(judgeVisit(false, 2, now - STRIKE_EXPIRY_MS - 1, now), 0);
  assert.equal(judgeVisit(true, 2, now - STRIKE_EXPIRY_MS - 1, now), 1);
  assert.equal(judgeVisit(false, 2, null, now), 2, 'legacy strikes without a time still count once');
});
