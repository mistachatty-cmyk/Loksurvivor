import assert from 'node:assert/strict';
import test from 'node:test';

import { combatForRarity, RARITY_ORDER } from '../../../../lib/lok-client/src/cards';
import { THEMED_PALETTES } from '../game/data/themedPalettes';
import { CARD_MANIFESTS } from '../game/data/cards';
import { LOK_SHOP_UNLOCKS } from '../game/data/lokShopUnlocks';
import { LOKTOKEN_ONLY_KINDS, LOKTOKEN_PRICE_BY_TIER, catalogSku } from './lokStoreCatalog';

test('every paid palette tier has a LokToken price and a unique SKU', () => {
  const skus = new Set<string>();
  for (const palette of THEMED_PALETTES.filter((entry) => entry.cost > 0)) {
    assert.ok(LOKTOKEN_PRICE_BY_TIER[palette.tier ?? 'standard'] > 0, `${palette.id} has no price`);
    const sku = catalogSku('palette', palette.id);
    assert.ok(!skus.has(sku), `duplicate sku ${sku}`);
    skus.add(sku);
  }
});

test('palettes are LokToken-only', () => {
  assert.ok(LOKTOKEN_ONLY_KINDS.has('palette'));
});

test('combat stats rise with rarity and every card rarity is known to the registry', () => {
  let last = 0;
  for (const rarity of RARITY_ORDER) {
    const combat = combatForRarity(rarity);
    assert.ok(combat.hp > last, `${rarity} should out-hp the tier below`);
    last = combat.hp;
  }
  for (const card of CARD_MANIFESTS) assert.ok(RARITY_ORDER.includes(card.rarity as never), `${card.id}: ${card.rarity}`);
});

test('the LokPack Visualizer is a legendary, LokToken-only Lok Shop unlock with its own SKU', () => {
  assert.ok(LOKTOKEN_ONLY_KINDS.has('packVisualizerUnlock'));
  const visualizer = LOK_SHOP_UNLOCKS.find((entry) => entry.id === 'lokpack-visualizer');
  assert.ok(visualizer);
  assert.equal(visualizer.kind, 'packVisualizerUnlock');
  assert.equal(visualizer.tier, 'legendary');
  assert.equal(LOKTOKEN_PRICE_BY_TIER.legendary, 1500);
  assert.equal(catalogSku(visualizer.kind, visualizer.id), 'survivor616.packVisualizerUnlock.lokpack-visualizer');
  const skus = LOK_SHOP_UNLOCKS.map((entry) => catalogSku(entry.kind, entry.id));
  assert.equal(new Set(skus).size, skus.length);
});
