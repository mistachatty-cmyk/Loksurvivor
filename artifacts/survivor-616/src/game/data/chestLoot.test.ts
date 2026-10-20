import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { CARD_COSMETICS_BY_ID } from '@/game/data/cardCosmetics';
import { CHEST_TIERS, CHEST_WINDOW_MS, chestOut, chestWindow, rollChest, type ChestPools } from '@/game/data/chestLoot';
import { PER_GRANT_MAX } from '@/game/engine/hideoutRewards';

const EN = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'locales', 'en.json'), 'utf8')) as Record<string, string>;

const pools = (owned: string[] = []): ChestPools => ({
  cards: [
    { id: 'c1', rarity: 'common' }, { id: 'u1', rarity: 'uncommon' }, { id: 'r1', rarity: 'rare' },
    { id: 'e1', rarity: 'epic' }, { id: 'l1', rarity: 'legendary' },
  ],
  cosmetics: [{ id: 'k1', tier: 'standard' }, { id: 'k2', tier: 'rare' }, { id: 'k3', tier: 'legendary' }],
  ownedCardIds: new Set(owned),
  ownedCosmeticIds: new Set(owned),
});

describe('lucky chest', () => {
  it('has a label for every tier and keeps filler within the per-grant limits', () => {
    for (const tier of CHEST_TIERS) {
      assert.ok(EN[tier.labelKey], tier.labelKey);
      for (const [key, amount] of Object.entries(tier.filler)) {
        const max = PER_GRANT_MAX[key as keyof typeof PER_GRANT_MAX];
        assert.ok(max !== undefined && (amount as number) <= max, `${tier.id}.${key}`);
      }
    }
  });

  it('is out on some windows and not others, and the same every time', () => {
    const outs = Array.from({ length: 200 }, (_, w) => chestOut(w));
    assert.ok(outs.some(Boolean) && outs.some((o) => !o));
    assert.equal(chestOut(17), chestOut(17));
    assert.equal(chestWindow(CHEST_WINDOW_MS * 3 + 5), 3);
  });

  it('rolls the same loot for the same seed and reaches every tier and kind', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 4000; seed += 1) {
      const loot = rollChest(seed, pools());
      assert.deepEqual(loot, rollChest(seed, pools()));
      seen.add(loot.tier);
      if (loot.cardId) seen.add('card');
      if (loot.cosmeticId) seen.add('cosmetic');
      if (loot.resource) seen.add('resource');
    }
    for (const id of ['common', 'uncommon', 'rare', 'ultra', 'card', 'cosmetic', 'resource']) assert.ok(seen.has(id), id);
  });

  it('never hands out something the player already owns', () => {
    const all = ['c1', 'u1', 'r1', 'e1', 'l1', 'k1', 'k2', 'k3'];
    for (let seed = 1; seed < 1500; seed += 1) {
      const loot = rollChest(seed, pools(all));
      assert.equal(loot.cardId, undefined);
      assert.equal(loot.cosmeticId, undefined);
      assert.ok(loot.resource);
    }
  });

  it('only names cosmetics that exist in the catalog', () => {
    for (const item of Object.values(CARD_COSMETICS_BY_ID)) assert.ok(item.id);
  });
});

describe('Chest Pass', () => {
  it('only ever adds windows where the chest is out', async () => {
    const { chestOut: out } = await import('@/game/data/chestLoot');
    let base = 0;
    let pass = 0;
    for (let w = 0; w < 400; w += 1) {
      if (out(w)) { base += 1; assert.ok(out(w, true), `window ${w}`); }
      if (out(w, true)) pass += 1;
    }
    assert.ok(pass > base);
  });
});
