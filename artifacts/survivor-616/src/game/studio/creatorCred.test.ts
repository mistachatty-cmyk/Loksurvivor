import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyCreatorCredTotal } from './creatorCred';

test('account Cred grants apply once even after a retry', () => {
  const first = applyCreatorCredTotal({ cred: 30, creatorCredApplied: 0 }, 100);
  assert.deepEqual(first, { cred: 130, creatorCredApplied: 100 });
  assert.equal(applyCreatorCredTotal(first, 100), first);
});

test('a stale device recovers all account grants', () => {
  const stale = { cred: 10, creatorCredApplied: 0 };
  assert.deepEqual(applyCreatorCredTotal(stale, 200), { cred: 210, creatorCredApplied: 200 });
  assert.deepEqual(applyCreatorCredTotal({ cred: 30, creatorCredApplied: 100 }, 200), { cred: 130, creatorCredApplied: 200 });
});
