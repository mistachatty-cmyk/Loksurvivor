import assert from 'node:assert/strict';
import test from 'node:test';

import { createInitialMeta, normalizeMeta, reducer } from './metaStore';

test('intro title physics defaults on, migrates older saves, and can be disabled', () => {
  assert.equal(createInitialMeta().introTitlePhysicsEnabled, true);
  assert.equal(createInitialMeta().introTitleReturnDelaySec, 4);
  assert.equal(normalizeMeta({ version: 1 }).introTitlePhysicsEnabled, true);
  assert.equal(normalizeMeta({ version: 1 }).introTitleReturnDelaySec, 4);
  assert.equal(normalizeMeta({ version: 1, introTitleReturnDelaySec: 99 }).introTitleReturnDelaySec, 12);
  assert.equal(normalizeMeta({ version: 1, introTitlePhysicsEnabled: false }).introTitlePhysicsEnabled, false);

  const updated = reducer(
    { meta: createInitialMeta(), lastRun: null },
    { type: 'setIntroTitlePhysicsEnabled', enabled: false },
  );
  assert.equal(updated.meta.introTitlePhysicsEnabled, false);

  const timed = reducer(updated, { type: 'setIntroTitleReturnDelay', seconds: 7 });
  assert.equal(timed.meta.introTitleReturnDelaySec, 7);
});
