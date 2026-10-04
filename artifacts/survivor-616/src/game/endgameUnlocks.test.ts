import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  CUSTOM_SLOTS, ENDGAME_FEATURES, MAX_CUSTOM_SLOTS, STANDARD_MAPS, earnedEndgame, endgameReached, isSlotEarned, mapsCleared, newlyEarned,
  type EndgameProgress,
} from '@/game/data/endgameUnlocks';
import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { FORGE_ID_PREFIX, generateForgedOperator } from '@/game/data/operatorForge';
import { registerForgedOperators, isForgeKit } from '@/game/data/forgedOperators';
import {
  FORGE_STORAGE_KEY, earnedSlotCount, freeSlotCount, isFeatureAvailable, isFeatureEnabled, loadRosterForgedOperators,
  recordEarnedEndgame, saveForgedOperator, setFeatureEnabled,
} from '@/game/state/operatorForgeStore';

function installStorage(): Map<string, string> {
  const data = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => { data.set(k, String(v)); },
    removeItem: (k: string) => { data.delete(k); },
    clear: () => data.clear(),
  };
  return data;
}

const allMaps = STANDARD_MAPS.map((a) => a.id);
const base: EndgameProgress = { clearedAreaIds: [], totalKills: 0, rescuedAllyIds: [], discoveryIds: [], lokPetBattleWins: 0 };
const maxed: EndgameProgress = {
  clearedAreaIds: allMaps, totalKills: 1_000_000, rescuedAllyIds: Array.from({ length: 30 }, (_, i) => `a${i}`),
  discoveryIds: Array.from({ length: 30 }, (_, i) => `d${i}`), lokPetBattleWins: 500,
};

describe('end-game unlock rules', () => {
  it('counts only timed standard maps: no endless modes, no extreme 2x/4x versions', () => {
    assert.ok(STANDARD_MAPS.length > 20);
    assert.ok(STANDARD_MAPS.every((a) => !a.endless));
    assert.ok(STANDARD_MAPS.length < AREAS.length);
    assert.ok(!STANDARD_MAPS.some((a) => a.id.startsWith('endless-')));
  });

  it('is locked until every standard map is cleared, and nothing is earned before then', () => {
    assert.equal(endgameReached(base), false);
    assert.deepEqual(earnedEndgame(maxed.clearedAreaIds.length ? { ...maxed, clearedAreaIds: allMaps.slice(1) } : base), []);
    assert.equal(mapsCleared({ clearedAreaIds: allMaps.slice(1) }).have, allMaps.length - 1);
    assert.equal(endgameReached({ clearedAreaIds: allMaps }), true);
  });

  it('has five slots, each with its own unique way to earn it', () => {
    assert.equal(MAX_CUSTOM_SLOTS, 5);
    assert.equal(new Set(CUSTOM_SLOTS.map((s) => s.id)).size, 5);
    assert.equal(new Set(CUSTOM_SLOTS.map((s) => s.how)).size, 5);
    // Clearing the maps alone earns exactly the first slot; the rest each need their own goal.
    const justMaps = { ...base, clearedAreaIds: allMaps };
    assert.deepEqual(CUSTOM_SLOTS.filter((s) => isSlotEarned(s, justMaps)).map((s) => s.id), [CUSTOM_SLOTS[0]!.id]);
    for (const slot of CUSTOM_SLOTS.slice(1)) {
      const goal = slot.goal!(base);
      assert.ok(goal.need > 0);
      assert.equal(isSlotEarned(slot, justMaps), false, slot.id);
    }
  });

  it('earns every feature and slot with full progress, and each slot depends on a different stat', () => {
    const earned = earnedEndgame(maxed);
    for (const f of ENDGAME_FEATURES) assert.ok(earned.includes(f.id));
    for (const s of CUSTOM_SLOTS) assert.ok(earned.includes(s.id));
    const statsMoved = new Set<string>();
    for (const [key, value] of [['totalKills', 1_000_000], ['rescuedAllyIds', maxed.rescuedAllyIds], ['discoveryIds', maxed.discoveryIds], ['lokPetBattleWins', 500]] as const) {
      const probe = { ...base, clearedAreaIds: allMaps, [key]: value } as EndgameProgress;
      const slots = CUSTOM_SLOTS.filter((s) => isSlotEarned(s, probe)).map((s) => s.id);
      assert.equal(slots.length, 2, key);
      slots.forEach((s) => statsMoved.add(s));
    }
    assert.equal(statsMoved.size, 5);
  });

  it('reports only what is newly earned', () => {
    const before = { ...base, clearedAreaIds: allMaps };
    const fresh = newlyEarned(before, maxed);
    assert.equal(fresh.length, CUSTOM_SLOTS.length - 1);
    assert.ok(fresh.every((id) => CUSTOM_SLOTS.some((s) => s.id === id)));
    assert.equal(newlyEarned(maxed, maxed).length, 0);
  });
});

describe('end-game store: toggles, slots and the roster', () => {
  beforeEach(() => { installStorage(); });

  const kit = CHARACTERS.find((c) => isForgeKit(c) && c.unlock.kind === 'default')!;
  const makeOp = (seed: string) => generateForgedOperator(seed, kit.id, new Set(), 1000);

  it('starts with nothing available, enabled or saveable', () => {
    for (const f of ENDGAME_FEATURES) { assert.equal(isFeatureAvailable(f.id), false); assert.equal(isFeatureEnabled(f.id), false); }
    assert.equal(earnedSlotCount(), 0);
    assert.equal(saveForgedOperator(makeOp('a')), false);
  });

  it('earned features start switched off and can be toggled on and off', () => {
    recordEarnedEndgame(earnedEndgame(maxed));
    for (const f of ENDGAME_FEATURES) { assert.equal(isFeatureAvailable(f.id), true); assert.equal(isFeatureEnabled(f.id), false); }
    setFeatureEnabled('inspector', true);
    assert.equal(isFeatureEnabled('inspector'), true);
    setFeatureEnabled('inspector', false);
    assert.equal(isFeatureEnabled('inspector'), false);
  });

  it('earning is permanent and idempotent, and ignores unknown ids', () => {
    assert.deepEqual(recordEarnedEndgame(['forge', 'nonsense']), ['forge']);
    assert.deepEqual(recordEarnedEndgame(['forge']), []);
    assert.equal(isFeatureAvailable('forge'), true);
  });

  it('holds exactly as many operators as there are earned slots', () => {
    recordEarnedEndgame(['forge', CUSTOM_SLOTS[0]!.id, CUSTOM_SLOTS[1]!.id]);
    assert.equal(freeSlotCount(), 2);
    assert.equal(saveForgedOperator(makeOp('a')), true);
    assert.equal(saveForgedOperator(makeOp('b')), true);
    assert.equal(freeSlotCount(), 0);
    assert.equal(saveForgedOperator(makeOp('c')), false);
    // Editing a saved one never needs a free slot.
    const first = JSON.parse(globalThis.localStorage.getItem(FORGE_STORAGE_KEY)!).operators[0];
    assert.equal(saveForgedOperator({ ...makeOp('a'), id: first.id }), true);
    recordEarnedEndgame([CUSTOM_SLOTS[2]!.id, CUSTOM_SLOTS[3]!.id, CUSTOM_SLOTS[4]!.id]);
    assert.equal(earnedSlotCount(), 5);
    assert.equal(freeSlotCount(), 3);
  });

  it('adds custom operators to the roster only while the Forge is on, and never replaces a premade one', () => {
    recordEarnedEndgame(['forge', CUSTOM_SLOTS[0]!.id]);
    assert.equal(saveForgedOperator(makeOp('a')), true);
    assert.equal(loadRosterForgedOperators().length, 0, 'Forge is off by default');
    setFeatureEnabled('forge', true);
    assert.equal(loadRosterForgedOperators().length, 1);

    const roster = [...CHARACTERS];
    const byId = Object.fromEntries(roster.map((c) => [c.id, c]));
    const before = roster.map((c) => c);
    const added = registerForgedOperators(roster, byId);
    assert.equal(added.length, 1);
    assert.ok(added[0]!.id.startsWith(FORGE_ID_PREFIX));
    assert.equal(roster.length, before.length + 1);
    assert.ok(before.every((c, i) => roster[i] === c), 'premade operators are the same objects in the same order');
  });

  it('keeps a Forge found before it became an end-game unlock, switched on', () => {
    (globalThis.localStorage as Storage).setItem(FORGE_STORAGE_KEY, JSON.stringify({ unlocked: true, operators: [] }));
    assert.equal(isFeatureAvailable('forge'), true);
    assert.equal(isFeatureEnabled('forge'), true);
    assert.equal(isFeatureAvailable('inspector'), false);
  });

  it('survives corrupt storage', () => {
    (globalThis.localStorage as Storage).setItem(FORGE_STORAGE_KEY, '{nope');
    assert.equal(earnedSlotCount(), 0);
    assert.equal(isFeatureEnabled('forge'), false);
  });
});
