import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AREAS } from '@/game/data/areas';
import { SPUR_LEADS, SPUR_WINDOW_MS, normalizeSpurAreaIds, spurAt } from '@/game/data/lightSpurs';
import { createInitialMeta, isUnlocked, reducer } from '@/game/state/metaStore';

const closed = () => false;

describe('light spurs', () => {
  it('only leads to real areas that are locked to start', () => {
    for (const lead of SPUR_LEADS) {
      const area = AREAS.find((a) => a.id === lead.areaId);
      assert.ok(area, lead.areaId);
      assert.ok(!isUnlocked(area.unlock, createInitialMeta()), `${lead.areaId} starts open`);
    }
  });

  it('shows the same spur for the same window, only some windows, and never for open places', () => {
    const seen = new Set<string>();
    let withSpur = 0;
    for (let w = 0; w < 300; w += 1) {
      const t = w * SPUR_WINDOW_MS + 5;
      const spur = spurAt(t, closed);
      assert.equal(spur?.areaId, spurAt(t + 1000, closed)?.areaId);
      if (spur) { withSpur += 1; seen.add(spur.areaId); }
    }
    assert.ok(withSpur > 60 && withSpur < 200);
    assert.equal(seen.size, SPUR_LEADS.length);
    for (let w = 0; w < 300; w += 1) assert.equal(spurAt(w * SPUR_WINDOW_MS, () => true), null);
  });

  it('unlocks the place when the spyglass is used on a window that has one', () => {
    let t = 0;
    for (let w = 1; w < 300; w += 1) if (spurAt(w * SPUR_WINDOW_MS + 5, closed)) { t = w * SPUR_WINDOW_MS + 5; break; }
    assert.ok(t > 0);
    const state = { meta: createInitialMeta(), lastRun: null, lastCardPackReveal: null };
    const after = reducer(state, { type: 'lookThroughSpyglass', now: t });
    assert.equal(after.meta.spurAreaIds.length, 1);
    assert.equal(after.meta.spurAreaIds[0], spurAt(t, closed)!.areaId);
  });

  it('cleans saved ids', () => {
    assert.deepEqual(normalizeSpurAreaIds(['null-sector', 'nope', 'null-sector', 4]), ['null-sector']);
    assert.deepEqual(normalizeSpurAreaIds('x'), []);
  });
});
