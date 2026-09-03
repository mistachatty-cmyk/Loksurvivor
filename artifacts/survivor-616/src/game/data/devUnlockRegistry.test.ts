import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEV_ACCESS_TAPS_REQUIRED,
  DEV_UNLOCK_REGISTRY,
  advanceDevAccessTap,
  effectiveCatalogIds,
} from '@/game/data/devUnlockRegistry';
import { RUN_AURAS } from '@/game/data/runAuras';
import { THEMED_PALETTES } from '@/game/data/themedPalettes';
import { UI_THEMES } from '@/game/data/uiThemes';
import { createInitialMeta, normalizeMeta, reducer } from '@/game/state/metaStore';

test('four deliberate taps unlock developer access exactly once', () => {
  let taps = 0;
  for (let index = 1; index <= DEV_ACCESS_TAPS_REQUIRED; index += 1) {
    const next = advanceDevAccessTap(taps);
    taps = next.taps;
    assert.equal(next.unlocked, index === DEV_ACCESS_TAPS_REQUIRED);
  }
  assert.deepEqual(advanceDevAccessTap(taps), { taps: DEV_ACCESS_TAPS_REQUIRED, unlocked: true });
});

test('the registry includes every current customization catalog entry', () => {
  assert.deepEqual(DEV_UNLOCK_REGISTRY.uiThemes, UI_THEMES.map((item) => item.id));
  assert.deepEqual(DEV_UNLOCK_REGISTRY.palettes, THEMED_PALETTES.map((item) => item.id));
  assert.deepEqual(DEV_UNLOCK_REGISTRY.runAuras, RUN_AURAS.map((item) => item.id));
  assert.ok(DEV_UNLOCK_REGISTRY.characters.length > 1);
  assert.ok(DEV_UNLOCK_REGISTRY.areas.length > 1);
  assert.ok(DEV_UNLOCK_REGISTRY.rooms.length > 1);
});

test('Dev Mode derives ownership and disabling restores real equipped assets', () => {
  const initial = createInitialMeta();
  const blocked = reducer({ meta: initial, lastRun: null }, { type: 'setDevModeAllUnlocks', enabled: true });
  assert.equal(blocked.meta.devModeAllUnlocks, false);

  let state = reducer(blocked, { type: 'unlockDevModeAccess' });
  state = reducer(state, { type: 'setDevModeAllUnlocks', enabled: true });
  assert.equal(state.meta.devModeAllUnlocks, true);
  assert.equal(effectiveCatalogIds(state.meta, 'palettes', state.meta.ownedPaletteIds).length, THEMED_PALETTES.length);

  state = reducer(state, { type: 'equipPalette', id: 'oil-slick-mirage' });
  state = reducer(state, { type: 'equipRunAura', id: 'mothlight' });
  assert.equal(state.meta.activePaletteId, 'oil-slick-mirage');
  assert.equal(state.meta.activeRunAuraId, 'mothlight');
  assert.deepEqual(state.meta.ownedPaletteIds, ['default']);
  assert.deepEqual(state.meta.ownedRunAuraIds, ['street-halo']);

  state = reducer(state, { type: 'setDevModeAllUnlocks', enabled: false });
  assert.equal(state.meta.activePaletteId, 'default');
  assert.equal(state.meta.activeRunAuraId, 'street-halo');
  assert.deepEqual(state.meta.ownedPaletteIds, ['default']);
});

test('old saves cannot retain enabled Dev Mode without completing the new access gate', () => {
  const migrated = normalizeMeta({ ...createInitialMeta(), version: 10, devModeAllUnlocks: true });
  assert.equal(migrated.version, 14);
  assert.equal(migrated.devModeAccessUnlocked, false);
  assert.equal(migrated.devModeAllUnlocks, false);
});
