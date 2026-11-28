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
