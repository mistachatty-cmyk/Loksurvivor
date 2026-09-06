import assert from 'node:assert/strict';
import test from 'node:test';

import { CHARACTERS } from './characters';
import {
  CRYPTO_FARM_CAPACITY_TIERS,
  CRYPTO_FARM_RATE_TIERS,
  ESSENCE_PACKS,
  applyRarityFloor,
  cardValue,
  rollCollectibleCard,
} from './cryptoFarm';

test('capacity tiers are ordered, level-1 is free, and each level raises the cap', () => {
  assert.equal(CRYPTO_FARM_CAPACITY_TIERS[0].level, 1);
  assert.equal(CRYPTO_FARM_CAPACITY_TIERS[0].cost, 0);
  for (let i = 1; i < CRYPTO_FARM_CAPACITY_TIERS.length; i++) {
    assert.ok(CRYPTO_FARM_CAPACITY_TIERS[i].maxBankedCharges > CRYPTO_FARM_CAPACITY_TIERS[i - 1].maxBankedCharges);
    assert.ok(CRYPTO_FARM_CAPACITY_TIERS[i].cost > CRYPTO_FARM_CAPACITY_TIERS[i - 1].cost);
  }
  assert.equal(CRYPTO_FARM_CAPACITY_TIERS[CRYPTO_FARM_CAPACITY_TIERS.length - 1].maxBankedCharges, 4);
});

test('rate tiers are ordered, level-0 is free, and each level raises the rate', () => {
  assert.equal(CRYPTO_FARM_RATE_TIERS[0].level, 0);
  assert.equal(CRYPTO_FARM_RATE_TIERS[0].cost, 0);
  for (let i = 1; i < CRYPTO_FARM_RATE_TIERS.length; i++) {
    assert.ok(CRYPTO_FARM_RATE_TIERS[i].chargePerSec > CRYPTO_FARM_RATE_TIERS[i - 1].chargePerSec);
    assert.ok(CRYPTO_FARM_RATE_TIERS[i].cost > CRYPTO_FARM_RATE_TIERS[i - 1].cost);
  }
});

test('essence packs are priced at the requested 1000/2000/3000/5000 ladder and escalate in value', () => {
  assert.deepEqual(ESSENCE_PACKS.map((pack) => pack.cost), [1000, 2000, 3000, 5000]);
  for (let i = 1; i < ESSENCE_PACKS.length; i++) {
    assert.ok(ESSENCE_PACKS[i].essenceMin > ESSENCE_PACKS[i - 1].essenceMin);
    assert.ok(ESSENCE_PACKS[i].cardChance >= ESSENCE_PACKS[i - 1].cardChance);
  }
});

test('rollCollectibleCard only ever names a real cast member', () => {
  const ids = new Set(CHARACTERS.map((c) => c.id));
  const rng = (() => {
    let i = 0;
    const seq = [0, 0.25, 0.5, 0.75, 0.999, 0.12, 0.61, 0.33];
    return () => seq[i++ % seq.length];
  })();
  for (let i = 0; i < 50; i++) {
    const card = rollCollectibleCard(rng);
    assert.ok(ids.has(card.characterId), `unknown character id "${card.characterId}"`);
    assert.ok(card.value > 0);
  }
});

test('rollCollectibleCard is deterministic for a given rng and respects a rarity floor', () => {
  const card = rollCollectibleCard(() => 0.99, 'legendary');
  assert.equal(card.rarity, 'legendary');
});

test('applyRarityFloor never lowers an already-higher roll', () => {
  assert.equal(applyRarityFloor('legendary', 'uncommon'), 'legendary');
  assert.equal(applyRarityFloor('standard', 'rare'), 'rare');
});

test('cardValue scales with both rarity and variant', () => {
  const base = cardValue('standard', 'standard');
  assert.ok(cardValue('legendary', 'standard') > base);
  assert.ok(cardValue('standard', 'gold') > base);
});
