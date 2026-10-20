import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CHEST_WINDOW_MS, chestOut } from '@/game/data/chestLoot';
import { chestStatus, openLuckyChest } from '@/game/engine/chestOpen';
import { createInitialMeta, reducer } from '@/game/state/metaStore';

function outTime(): number {
  for (let w = 1; w < 200; w += 1) if (chestOut(w)) return w * CHEST_WINDOW_MS + 1000;
  throw new Error('chest never out');
}
function awayTime(): number {
  for (let w = 1; w < 200; w += 1) if (!chestOut(w)) return w * CHEST_WINDOW_MS + 1000;
  throw new Error('chest always out');
}

describe('opening the lucky chest', () => {
  it('only opens while it is out, and only once per window', () => {
    const meta = createInitialMeta();
    const now = outTime();
    assert.equal(chestStatus(meta, now), 'out');
    assert.equal(chestStatus(meta, awayTime()), 'away');
    assert.equal(openLuckyChest(meta, awayTime(), 1, 3), null);
    const first = openLuckyChest(meta, now, 1, 3);
    assert.ok(first);
    assert.equal(chestStatus(first.meta, now + 5000), 'opened');
    assert.equal(openLuckyChest(first.meta, now + 5000, 2, 3), null);
  });

  it('pays through the reducer exactly what the preview said', () => {
    const state = { meta: createInitialMeta(), lastRun: null, lastCardPackReveal: null };
    const now = outTime();
    const preview = openLuckyChest(state.meta, now, 77, 3)!;
    const after = reducer(state, { type: 'openLuckyChest', now, seed: 77 });
    assert.equal(after.meta.cred, preview.meta.cred);
    assert.equal(after.meta.cardCollection.length, preview.meta.cardCollection.length);
    assert.deepEqual(after.meta.hideoutClaims, preview.meta.hideoutClaims);
  });
});
