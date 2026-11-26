import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createInitialMeta, devAwareReducer, persistableMeta, normalizeMeta } from './metaStore';

const fresh = () => ({ meta: { ...createInitialMeta(), cred: 120, skeletonKeys: 3 }, lastRun: null, lastCardPackReveal: null });

test('a Dev Mode session opens everything and tops up every currency', () => {
  const on = devAwareReducer(fresh(), { type: 'unlockDevModeAccess' });
  assert.equal(on.meta.devModeAllUnlocks, true);
  assert.equal(on.meta.cred, 99_999_999);
  assert.equal(on.meta.skeletonKeys, 99_999_999);
});

test('spending inside the session is refilled, and what is written to storage is the real save', () => {
  const on = devAwareReducer(fresh(), { type: 'unlockDevModeAccess' });
  const saved = persistableMeta(on);
  assert.equal(saved.cred, 120);
  assert.equal(saved.skeletonKeys, 3);
  assert.equal(saved.devModeAccessUnlocked, false);
  assert.equal(saved.devModeAllUnlocks, false);
});

test('turning Dev Mode off puts the real numbers back and closes dev access', () => {
  const on = devAwareReducer(fresh(), { type: 'unlockDevModeAccess' });
  const off = devAwareReducer(on, { type: 'setDevModeAllUnlocks', enabled: false });
  assert.equal(off.meta.cred, 120);
  assert.equal(off.meta.skeletonKeys, 3);
  assert.equal(off.meta.devModeAllUnlocks, false);
  assert.equal(off.meta.devModeAccessUnlocked, false);
  assert.equal(off.devStash, undefined);
});

test('a reload never brings Dev Mode back, even from a save that says it was on', () => {
  const loaded = normalizeMeta({ ...createInitialMeta(), devModeAccessUnlocked: true, devModeAllUnlocks: true });
  assert.equal(loaded.devModeAccessUnlocked, false);
  assert.equal(loaded.devModeAllUnlocks, false);
});
