import assert from 'node:assert/strict';
import test from 'node:test';

import { RUN_AURAS } from '@/game/data/runAuras';
import { THEMED_PALETTES } from '@/game/data/themedPalettes';
import { createInitialMeta, normalizeMeta, reducer } from '@/game/state/metaStore';

test('the customization shop has twenty new palettes and a deep animated collection', () => {
  assert.ok(THEMED_PALETTES.length >= 30, 'the original ten plus at least twenty new palettes');
  assert.equal(new Set(THEMED_PALETTES.map((palette) => palette.id)).size, THEMED_PALETTES.length);
  assert.ok(THEMED_PALETTES.filter((palette) => palette.effect).length >= 15);
  assert.ok(new Set(THEMED_PALETTES.flatMap((palette) => palette.effect?.kind ?? [])).size >= 5);
  for (const palette of THEMED_PALETTES) {
    assert.ok(palette.cost >= 0);
    for (const color of Object.values(palette.palette)) assert.match(color, /^#[0-9a-f]{6}$/i);
    if (palette.effect) {
      assert.ok(palette.effect.speed > 0);
      assert.ok(palette.effect.intensity > 0 && palette.effect.intensity <= 1);
    }
  }
});

test('run auras cover five paid styles across multiple cosmetic tiers', () => {
  assert.equal(RUN_AURAS.filter((aura) => aura.cost > 0).length, 5);
  assert.equal(new Set(RUN_AURAS.map((aura) => aura.id)).size, RUN_AURAS.length);
  assert.deepEqual(new Set(RUN_AURAS.map((aura) => aura.tier)), new Set(['standard', 'uncommon', 'rare', 'legendary']));
});

test('aura purchases charge once and only owned auras can be equipped', () => {
  const initial = { ...createInitialMeta(), lootTokens: 10 };
  const bought = reducer(
    { meta: initial, lastRun: null },
    { type: 'buyRunAura', id: 'mothlight' },
  );
  assert.equal(bought.meta.lootTokens, 6);
  assert.ok(bought.meta.ownedRunAuraIds.includes('mothlight'));

  const duplicate = reducer(bought, { type: 'buyRunAura', id: 'mothlight' });
  assert.equal(duplicate.meta.lootTokens, 6);

  const rejected = reducer(duplicate, { type: 'equipRunAura', id: 'rain-signal' });
  assert.equal(rejected.meta.activeRunAuraId, 'street-halo');

  const equipped = reducer(duplicate, { type: 'equipRunAura', id: 'mothlight' });
  assert.equal(equipped.meta.activeRunAuraId, 'mothlight');
});

test('version ten Lookbook-era saves migrate without carrying portable customization data', () => {
  const migrated = normalizeMeta({
    ...createInitialMeta(),
    version: 10,
    customizationLooks: [{ id: 'old-lookbook-record' }],
  } as ReturnType<typeof createInitialMeta> & { customizationLooks: unknown[] });
  assert.equal(migrated.version, 10);
  assert.equal('customizationLooks' in migrated, false);
  assert.deepEqual(migrated.ownedRunAuraIds, ['street-halo']);
  assert.equal(migrated.activeRunAuraId, 'street-halo');
});
