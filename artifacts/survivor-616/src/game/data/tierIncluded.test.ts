import assert from 'node:assert/strict';
import test from 'node:test';

import { THEMED_PALETTES } from '@/game/data/themedPalettes';
import { includedRarities, isTierIncluded, tierIncludedIds } from '@/game/data/tierIncluded';

test('no tier or a lapsed tier includes nothing, and a Pass alone includes nothing automatically', () => {
  for (const active of [null, 'pass'] as const) {
    assert.deepEqual(includedRarities(active), []);
    assert.equal(tierIncludedIds(active, 'palettes').length, 0);
  }
});

test('Passport includes exactly the rare cosmetics, Lifetime adds the legendary ones', () => {
  const rare = THEMED_PALETTES.filter((p) => p.tier === 'rare').map((p) => p.id);
  const legendary = THEMED_PALETTES.filter((p) => p.tier === 'legendary').map((p) => p.id);
  assert.deepEqual(tierIncludedIds('passport', 'palettes').sort(), rare.sort());
  assert.deepEqual(tierIncludedIds('lifetime', 'palettes').sort(), [...rare, ...legendary].sort());
  assert.ok(rare.length > 0 && legendary.length > 0);
});

test('free-tier cosmetics are never "included" (they stay free for everyone)', () => {
  const standard = THEMED_PALETTES.find((p) => p.tier === 'standard')!;
  assert.equal(isTierIncluded('lifetime', 'palettes', standard.id), false);
});

test('hats and celebrations follow the same rule', () => {
  assert.ok(tierIncludedIds('passport', 'hats').length >= 1);
  assert.ok(tierIncludedIds('lifetime', 'celebrations').length >= tierIncludedIds('passport', 'celebrations').length);
});

test('ownership: a Passport includes rare items only while active, and equipped items fall back on lapse', async () => {
  const { createInitialMeta, normalizeMeta, reducer } = await import('@/game/state/metaStore');
  const { effectiveCatalogIds, hasCatalogItem } = await import('@/game/data/devUnlockRegistry');
  const rare = THEMED_PALETTES.find((p) => p.tier === 'rare')!;
  const legendary = THEMED_PALETTES.find((p) => p.tier === 'legendary')!;
  const base = createInitialMeta();
  assert.equal(hasCatalogItem(base, 'palettes', rare.id, base.ownedPaletteIds), false);

  const passport = { ...base, activeSupporterTier: 'passport' as const };
  assert.equal(hasCatalogItem(passport, 'palettes', rare.id, base.ownedPaletteIds), true);
  assert.equal(hasCatalogItem(passport, 'palettes', legendary.id, base.ownedPaletteIds), false, 'legendary needs Lifetime');
  assert.ok(effectiveCatalogIds(passport, 'palettes', base.ownedPaletteIds).includes(rare.id));

  // Equip through the real reducer, then let the tier lapse.
  let state = { meta: reducer({ meta: base } as never, { type: 'setSupporterTier', tier: 'passport' }).meta } as never;
  state = reducer(state, { type: 'equipPalette', id: rare.id });
  assert.equal((state as { meta: { activePaletteId: string } }).meta.activePaletteId, rare.id);
  state = reducer(state, { type: 'setSupporterTier', tier: null });
  assert.notEqual((state as { meta: { activePaletteId: string } }).meta.activePaletteId, rare.id, 'lapsed: back to the default');
  assert.equal((state as { meta: { activeSupporterTier: null } }).meta.activeSupporterTier, null);
});

test('a saved equipped tier item survives a reload, and the tier is never read from a save', async () => {
  const { normalizeMeta } = await import('@/game/state/metaStore');
  const rare = THEMED_PALETTES.find((p) => p.tier === 'rare')!;
  const loaded = normalizeMeta({ version: 1, activePaletteId: rare.id, activeSupporterTier: 'lifetime' });
  assert.equal(loaded.activePaletteId, rare.id);
  assert.equal(loaded.activeSupporterTier, null, 'a save can never grant a tier');
});
