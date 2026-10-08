import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { generateForgedOperator } from '@/game/data/operatorForge';
import { SPRITE_FIXTURE } from './customRunUse.fixture';
import {
  customEnemyPalette, customPetPalette, exportForgeState, importForgeState, isCustomActive, isHideoutDockEnabled,
  loadRosterForgedOperators, recordEarnedEndgame, saveCustomVariant, saveForgedOperator, setAllCustomsActive,
  setCustomActive, setCustomMaster, setFeatureEnabled, setHideoutDockEnabled,
} from '@/game/state/operatorForgeStore';

function installStorage() {
  const data = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => { data.set(k, String(v)); },
    removeItem: (k: string) => { data.delete(k); },
    clear: () => data.clear(),
  };
}

const variant = (id: string, baseId: string) => ({ id, baseId, name: id, palette: SPRITE_FIXTURE, createdAt: 1 });

describe('customs in runs', () => {
  beforeEach(() => installStorage());

  it('is on by default and the master switch overrides every item', () => {
    saveCustomVariant('enemy', variant('e1', 'grunt'));
    assert.equal(isCustomActive('enemies', 'e1'), true);
    assert.ok(customEnemyPalette('grunt'));
    setCustomActive('enemies', 'e1', false);
    assert.equal(customEnemyPalette('grunt'), undefined, 'an item switched off is not applied');
    setCustomActive('enemies', 'e1', true);
    setCustomMaster(false);
    assert.equal(customEnemyPalette('grunt'), undefined, 'master off hides every custom');
    assert.equal(isCustomActive('enemies', 'e1'), false);
  });

  it('all on / all off touch every saved custom', () => {
    saveCustomVariant('enemy', variant('e1', 'a'));
    saveCustomVariant('pet', variant('p1', 'lil-llama'));
    setAllCustomsActive(false);
    assert.equal(customPetPalette('lil-llama'), undefined);
    setAllCustomsActive(true);
    assert.ok(customPetPalette('lil-llama'));
    assert.ok(customEnemyPalette('a'));
  });

  it('an operator switched off leaves the roster but stays saved', () => {
    recordEarnedEndgame(['forge', 'slot-circuit']);
    setFeatureEnabled('forge', true);
    const op = generateForgedOperator('seed-x', 'street-reporter', new Set(), 1);
    assert.equal(saveForgedOperator(op), true);
    assert.equal(loadRosterForgedOperators().length, 1);
    setCustomActive('operators', op.id, false);
    assert.equal(loadRosterForgedOperators().length, 0);
    assert.equal(exportForgeState().operators.length, 1);
  });

  it('old saves without the new fields load with defaults, and junk is dropped', () => {
    assert.equal(importForgeState({ unlocked: false, operators: [], earned: [], toggles: {} }), true);
    const state = exportForgeState();
    assert.equal(state.runUse.master, true);
    assert.equal(state.hideoutDock, true);
    assert.equal(importForgeState({ unlocked: false, operators: [], earned: [], toggles: {}, customEnemies: [{ id: 'x', baseId: 'y', palette: { body: 'red' } }, 5], runUse: { master: false, enemies: { a: 'no', b: false } } }), true);
    const next = exportForgeState();
    assert.equal(next.customEnemies.length, 0, 'a look with an invalid palette is dropped');
    assert.equal(next.runUse.master, false);
    assert.deepEqual(next.runUse.enemies, { b: false });
  });

  it('the hideout dock setting round-trips', () => {
    assert.equal(isHideoutDockEnabled(), true);
    setHideoutDockEnabled(false);
    assert.equal(isHideoutDockEnabled(), false);
  });
});
