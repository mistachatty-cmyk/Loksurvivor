/**
 * The hideout's crypto farm: a passive Digital Essence generator plus the
 * essence-pack shop and collectible cast-card table it feeds.
 *
 * Kept as plain data/pure functions (no `Math.random()` calls hard-baked into
 * the tables themselves) so `cryptoFarm.test.ts` can drive rolls with a seeded
 * `rng` and the reducer in `metaStore.tsx` stays the only place that touches
 * real randomness or the wall clock.
 */
import { CHARACTERS } from './characters';
import type { CollectibleCardRarity, CollectibleCardVariant, CryptoFarmCapacityTierDef, CryptoFarmRateTierDef, EssencePackDef, OwnedCollectibleCard } from '@/game/types';

/** Base fill rate before any "overclock" tier is purchased. ~20s per charge. */
export const CRYPTO_FARM_BASE_RATE = 0.05;

/** Cred cost to buy the rig itself; bundles capacity tier 1 and rate tier 0. */
export const CRYPTO_FARM_UNLOCK_COST = 200;

/**
 * Charge capacity ladder. Level 1 is free with the unlock; each further level
 * is a purchase. Reaching the last tier ("maxed") unlocks a chance for a
 * banked charge to also drop a free essence pack on collect -- see
 * `CRYPTO_FARM_MAXED_LEVEL` in `metaStore.tsx`.
 */
export const CRYPTO_FARM_CAPACITY_TIERS: CryptoFarmCapacityTierDef[] = [
  { level: 1, maxBankedCharges: 1, cost: 0 },
  { level: 2, maxBankedCharges: 2, cost: 300 },
  { level: 3, maxBankedCharges: 3, cost: 900 },
  { level: 4, maxBankedCharges: 4, cost: 2200 },
];

/** Rate ("overclock") ladder. Level 0 is free with the unlock. */
export const CRYPTO_FARM_RATE_TIERS: CryptoFarmRateTierDef[] = [
  { level: 0, chargePerSec: CRYPTO_FARM_BASE_RATE, cost: 0 },
  { level: 1, chargePerSec: 0.08, cost: 250 },
  { level: 2, chargePerSec: 0.13, cost: 700 },
  { level: 3, chargePerSec: 0.22, cost: 1800 },
  { level: 4, chargePerSec: 0.37, cost: 4000 },
];

export const ESSENCE_PACKS: EssencePackDef[] = [
  {
    id: 'copper-essence-pack',
    name: 'Copper Essence Pack',
    description: 'A cheap rip. Mostly Digital Essence, small odds at a card.',
    cost: 1000,
    essenceMin: 40,
    essenceMax: 60,
    cardRolls: 1,
    cardChance: 0.12,
  },
  {
    id: 'silver-essence-pack',
    name: 'Silver Essence Pack',
    description: 'Better yield, better odds at pulling a cast card.',
    cost: 2000,
    essenceMin: 90,
    essenceMax: 130,
    cardRolls: 1,
    cardChance: 0.22,
  },
  {
    id: 'gold-essence-pack',
    name: 'Gold Essence Pack',
    description: 'Two card rolls, the first guaranteed at least Uncommon.',
    cost: 3000,
    essenceMin: 150,
    essenceMax: 210,
    cardRolls: 2,
    cardChance: 0.35,
    guaranteeMinRarity: 'uncommon',
  },
  {
    id: 'platinum-essence-pack',
    name: 'Platinum Essence Pack',
    description: 'Three card rolls, the first guaranteed at least Rare.',
    cost: 5000,
    essenceMin: 260,
    essenceMax: 340,
    cardRolls: 3,
    cardChance: 0.45,
    guaranteeMinRarity: 'rare',
  },
];

export const ESSENCE_PACKS_BY_ID: Record<string, EssencePackDef> = Object.fromEntries(
  ESSENCE_PACKS.map((pack) => [pack.id, pack]),
);

const RARITY_ORDER: CollectibleCardRarity[] = ['standard', 'uncommon', 'rare', 'legendary'];
const RARITY_WEIGHTS: Record<CollectibleCardRarity, number> = {
  standard: 60,
  uncommon: 27,
  rare: 10,
  legendary: 3,
};
const RARITY_VALUE: Record<CollectibleCardRarity, number> = {
  standard: 5,
  uncommon: 15,
  rare: 40,
  legendary: 120,
};
export const RARITY_LABEL: Record<CollectibleCardRarity, string> = {
  standard: 'Standard',
  uncommon: 'Uncommon',
  rare: 'Rare',
  legendary: 'Legendary',
};

const VARIANT_WEIGHTS: Record<CollectibleCardVariant, number> = {
  standard: 70,
  foil: 22,
  holo: 7,
  gold: 1,
};
const VARIANT_VALUE_MULT: Record<CollectibleCardVariant, number> = {
  standard: 1,
  foil: 1.8,
  holo: 3,
  gold: 6,
};
export const VARIANT_LABEL: Record<CollectibleCardVariant, string> = {
  standard: 'Standard',
  foil: 'Foil',
  holo: 'Holo',
  gold: 'Gold',
};

function weightedPick<T extends string>(weights: Record<T, number>, roll: number): T {
  const entries = Object.entries(weights) as Array<[T, number]>;
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let remaining = roll * total;
  for (const [key, weight] of entries) {
    remaining -= weight;
    if (remaining <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

export function cardValue(rarity: CollectibleCardRarity, variant: CollectibleCardVariant): number {
  return Math.round(RARITY_VALUE[rarity] * VARIANT_VALUE_MULT[variant]);
}

/** Raises a rolled rarity up to `minRarity` if it landed lower. Never lowers it. */
export function applyRarityFloor(rarity: CollectibleCardRarity, minRarity: CollectibleCardRarity): CollectibleCardRarity {
  return RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf(minRarity) ? rarity : minRarity;
}

export interface RolledCard {
  characterId: string;
  rarity: CollectibleCardRarity;
  variant: CollectibleCardVariant;
  value: number;
}

/**
 * Rolls one card from the full survivor-616 cast -- including characters the
 * player hasn't unlocked yet, mirroring the "discover before you can play
 * them" pull feel `let's spend it all` uses for its LOKdex.
 */
export function rollCollectibleCard(rng: () => number = Math.random, minRarity?: CollectibleCardRarity): RolledCard {
  const character = CHARACTERS[Math.floor(rng() * CHARACTERS.length)] ?? CHARACTERS[0];
  let rarity = weightedPick(RARITY_WEIGHTS, rng());
  if (minRarity) rarity = applyRarityFloor(rarity, minRarity);
  const variant = weightedPick(VARIANT_WEIGHTS, rng());
  return { characterId: character.id, rarity, variant, value: cardValue(rarity, variant) };
}

export function toOwnedCard(card: RolledCard, source: OwnedCollectibleCard['source'], now: number, instanceId: string): OwnedCollectibleCard {
  return {
    instanceId,
    characterId: card.characterId,
    rarity: card.rarity,
    rarityLabel: RARITY_LABEL[card.rarity],
    variant: card.variant,
    value: card.value,
    acquiredAt: now,
    source,
  };
}
