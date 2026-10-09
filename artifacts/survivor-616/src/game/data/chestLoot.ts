/**
 * The Lucky Chest: a special chest that turns up now and then in the hideout.
 *
 * The chest is out during some fixed windows (a pure function of the window number, like
 * the sky in `skyEvents.ts`) and can be opened once per window it is out. What is inside
 * comes from `CHEST_TIERS`: four rarity tiers, each with its own filler resources and a
 * chance of a card or a card cosmetic of that rarity. Tuning is all in this file.
 */
import { createRng } from '@/game/engine/math';
import type { SmallReward } from '@/game/engine/hideoutRewards';
import type { LokAssetRarity } from '@/game/lok/types';
import type { CardCosmeticTier } from '@/game/data/cardCosmetics';

/** The chest is re-rolled this often. */
export const CHEST_WINDOW_MS = 6 * 60 * 60 * 1000;

/** Chance a window has the chest out. */
export const CHEST_OUT_CHANCE = 0.4;

export type ChestTierId = 'common' | 'uncommon' | 'rare' | 'ultra';

export interface ChestTierDef {
  id: ChestTierId;
  /** Chance weight among the tiers. */
  weight: number;
  labelKey: string;
  accent: string;
  /** Resources paid when the roll lands on filler (or the card/cosmetic was a duplicate). */
  filler: SmallReward;
  /** Chance weights for what the tier holds. */
  kinds: { filler: number; card: number; cosmetic: number };
  /** Card rarities this tier can hold. */
  cardRarities: LokAssetRarity[];
  /** Cosmetic tiers this tier can hold. */
  cosmeticTiers: CardCosmeticTier[];
}

export const CHEST_TIERS: ChestTierDef[] = [
  { id: 'common', weight: 55, labelKey: 'chest.tier.common', accent: '#cbd5e1', filler: { cred: 12 }, kinds: { filler: 1, card: 0, cosmetic: 0 }, cardRarities: [], cosmeticTiers: [] },
  { id: 'uncommon', weight: 28, labelKey: 'chest.tier.uncommon', accent: '#4ade80', filler: { cred: 15, lokPetTreats: 1 }, kinds: { filler: 3, card: 2, cosmetic: 1 }, cardRarities: ['common', 'uncommon'], cosmeticTiers: ['standard', 'uncommon'] },
  { id: 'rare', weight: 14, labelKey: 'chest.tier.rare', accent: '#60a5fa', filler: { cred: 15, cardCredits: 1, petElixirs: 1 }, kinds: { filler: 2, card: 3, cosmetic: 2 }, cardRarities: ['rare', 'epic'], cosmeticTiers: ['rare'] },
  { id: 'ultra', weight: 3, labelKey: 'chest.tier.ultra', accent: '#f472b6', filler: { cred: 15, cardCredits: 2, petElixirs: 1 }, kinds: { filler: 1, card: 3, cosmetic: 2 }, cardRarities: ['legendary', 'mythic'], cosmeticTiers: ['legendary'] },
];

export interface ChestLoot {
  tier: ChestTierId;
  /** Resources to pay (always present when no card or cosmetic was found). */
  resource?: SmallReward;
  cardId?: string;
  cosmeticId?: string;
}

/** What the chest may hand out, and what the player already has. */
export interface ChestPools {
  cards: ReadonlyArray<{ id: string; rarity: LokAssetRarity }>;
  cosmetics: ReadonlyArray<{ id: string; tier: CardCosmeticTier }>;
  ownedCardIds: ReadonlySet<string>;
  ownedCosmeticIds: ReadonlySet<string>;
}

export function chestWindow(now: number): number {
  return Math.floor(now / CHEST_WINDOW_MS);
}

/** Whether the chest is out during `window`. */
export function chestOut(window: number): boolean {
  return createRng(window * 104729 + 7)() < CHEST_OUT_CHANCE;
}

export function chestClaimKey(window: number): string {
  return `chest.${window}`;
}

function weighted<T>(rows: readonly T[], weight: (row: T) => number, roll: number): T | undefined {
  const total = rows.reduce((sum, row) => sum + Math.max(0, weight(row)), 0);
  let pick = roll * total;
  for (const row of rows) {
    pick -= Math.max(0, weight(row));
    if (pick <= 0) return row;
  }
  return rows[rows.length - 1];
}

/** Rolls a chest. The same seed and pools always give the same loot. */
export function rollChest(seed: number, pools: ChestPools, tiers: readonly ChestTierDef[] = CHEST_TIERS): ChestLoot {
  const rng = createRng(seed);
  const tier = weighted(tiers, (t) => t.weight, rng())!;
  const kind = weighted(['filler', 'card', 'cosmetic'] as const, (k) => tier.kinds[k], rng())!;
  const pick = rng();
  if (kind === 'card') {
    const options = pools.cards.filter((c) => tier.cardRarities.includes(c.rarity) && !pools.ownedCardIds.has(c.id));
    if (options.length > 0) return { tier: tier.id, cardId: options[Math.floor(pick * options.length) % options.length]!.id };
  } else if (kind === 'cosmetic') {
    const options = pools.cosmetics.filter((c) => tier.cosmeticTiers.includes(c.tier) && !pools.ownedCosmeticIds.has(c.id));
    if (options.length > 0) return { tier: tier.id, cosmeticId: options[Math.floor(pick * options.length) % options.length]!.id };
  }
  return { tier: tier.id, resource: tier.filler };
}
