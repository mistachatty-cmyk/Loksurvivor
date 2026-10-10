import assert from 'node:assert/strict';
import test from 'node:test';

import { combatForRarity, RARITY_ORDER } from '../../../../lib/lok-client/src/cards';
import { THEMED_PALETTES } from '../game/data/themedPalettes';
import { CARD_MANIFESTS } from '../game/data/cards';
import { LOKTOKEN_ONLY_KINDS, LOKTOKEN_PRICE_BY_TIER, PASSPORT_TIERS, catalogSku } from './lokStoreCatalog';

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

test('every Lok Passport tier has a unique sku, a rising price and a matching meta flag', () => {
  assert.ok(LOKTOKEN_ONLY_KINDS.has('passportTier'));
  const skus = new Set<string>();
  const flags = new Set<string>();
  let lastPrice = 0;
  for (const tier of PASSPORT_TIERS) {
    const sku = catalogSku('passportTier', tier.skuId);
    assert.ok(!skus.has(sku), `duplicate sku ${sku}`);
    skus.add(sku);
    assert.ok(!flags.has(tier.metaFlag), `duplicate meta flag ${tier.metaFlag}`);
    flags.add(tier.metaFlag);
    assert.ok(tier.price > lastPrice, `${tier.skuId} should cost more than the tier below`);
    lastPrice = tier.price;
  }
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
