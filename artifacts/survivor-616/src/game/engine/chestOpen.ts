/**
 * Opening the Lucky Chest (`data/chestLoot.ts`) against a save.
 *
 * Pure: the hub previews with the same seed the reducer will use, so the toast shows
 * exactly what was paid. Resources go through the shared hideout policy; a card or a
 * cosmetic is a one-off find limited by the chest's own window, one open per window.
 */
import { CARD_MANIFESTS, isCardOwned } from '@/game/data/cards';
import { CARD_COSMETICS_BY_ID, grantCardCosmetic, isCardCosmeticOwned } from '@/game/data/cardCosmetics';
import {
  CHEST_CLAIM_KEY,
  chestOpenedThisWindow,
  chestOut,
  chestWindow,
  rollChest,
  type ChestLoot,
  type ChestPools,
} from '@/game/data/chestLoot';
import { mergeCardPulls } from '@/game/data/passiveCards';
import { grantWithFallback, trimClaims, type SmallReward } from '@/game/engine/hideoutRewards';
import type { MetaState } from '@/game/types';

type ChestMeta = Pick<
  MetaState,
  | 'cred' | 'cardCredits' | 'lokPetTreats' | 'petElixirs' | 'skeletonKeys' | 'savedLokPets' | 'hideoutClaims' | 'hideoutLedger' | 'eventBuff'
  | 'cardCollection' | 'cardFrameSleeves' | 'ownedCardBackIds' | 'ownedPackSkinIds' | 'selectedCardFrame' | 'selectedCardBack' | 'selectedPackSkin'
>;

export type ChestStatus = 'out' | 'away' | 'opened';

export function chestStatus(meta: Pick<MetaState, 'hideoutClaims'>, now: number): ChestStatus {
  const window = chestWindow(now);
  if (!chestOut(window)) return 'away';
  return chestOpenedThisWindow(meta.hideoutClaims[CHEST_CLAIM_KEY], now) ? 'opened' : 'out';
}

function poolsFor(meta: ChestMeta): ChestPools {
  const cosmetics = Object.values(CARD_COSMETICS_BY_ID).filter((item) => item.cost > 0);
  return {
    cards: CARD_MANIFESTS.map((card) => ({ id: card.id, rarity: card.rarity })),
    cosmetics: cosmetics.map((item) => ({ id: item.id, tier: item.tier })),
    ownedCardIds: new Set(CARD_MANIFESTS.filter((card) => isCardOwned(card, meta as MetaState)).map((card) => card.id)),
    ownedCosmeticIds: new Set(cosmetics.filter((item) => isCardCosmeticOwned(meta, item)).map((item) => item.id)),
  };
}

export interface ChestOpening<T extends ChestMeta> {
  meta: T;
  loot: ChestLoot;
  /** What the resource part actually paid after the daily limits. */
  applied: SmallReward;
}

/** Opens the chest, or returns null when it is away, already opened, or paid nothing. */
export function openLuckyChest<T extends ChestMeta>(meta: T, now: number, seed: number, elixirCap: number): ChestOpening<T> | null {
  if (chestStatus(meta, now) !== 'out') return null;
  const loot = rollChest(seed, poolsFor(meta));
  let next: T = meta;
  let applied: SmallReward = {};
  if (loot.cardId) {
    next = { ...next, cardCollection: mergeCardPulls(next.cardCollection, [{ cardId: loot.cardId, variant: 'standard', value: 0 }]) };
  } else if (loot.cosmeticId) {
    const item = CARD_COSMETICS_BY_ID[loot.cosmeticId];
    if (item) next = grantCardCosmetic(next, item);
  } else if (loot.resource) {
    const paid = grantWithFallback(next, loot.resource, undefined, { now, elixirCap });
    if (!paid.paid) return null;
    next = paid.meta;
    applied = paid.applied;
  }
  const claims = trimClaims({ ...next.hideoutClaims, [CHEST_CLAIM_KEY]: now });
  return { meta: { ...next, hideoutClaims: claims }, loot, applied };
}
