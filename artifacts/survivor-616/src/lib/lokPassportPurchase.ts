/**
 * Buying an Operator Forge Lok Passport tier. This spends real LokTokens
 * against the shared economy (`useLokEconomy().spend`, the same server-
 * authoritative path every other LokToken-only cosmetic already uses) --
 * there is no separate "real money" purchase here, and none is needed: the
 * three tiers are earn-and-spend unlocks, not a subscription billed by a
 * payment processor. See `.agents/memory/lok-passport-slots.md`.
 */
import type { SpendResult } from '@workspace/lok-client';

import { catalogSku, PASSPORT_TIERS, type PassportTierDef } from '@/lib/lokStoreCatalog';

export type LokPassportTier = PassportTierDef['metaFlag'];

export interface LokPassportPurchaseResult {
  ok: boolean;
  message: string;
}

const MESSAGE_BY_ERROR: Record<string, string> = {
  not_signed_in: 'Sign in to buy from the Lok Shop.',
  insufficient: "You don't have enough LokTokens yet.",
  already_owned: 'Already owned.',
  rank_locked: "Your rank doesn't unlock this yet.",
  sold_out: 'Sold out.',
  unknown_item: "That tier isn't in the catalog yet -- check back soon.",
  no_account: 'Sign in to buy from the Lok Shop.',
};

export async function requestLokPassportPurchase(
  tier: PassportTierDef,
  spend: (sku: string) => Promise<SpendResult>,
  grant: (tier: LokPassportTier, enabled: boolean) => void,
): Promise<LokPassportPurchaseResult> {
  const result = await spend(catalogSku('passportTier', tier.skuId));
  if (result.ok || result.error === 'already_owned') {
    grant(tier.metaFlag, true);
    return { ok: true, message: `${tier.name} unlocked.` };
  }
  return { ok: false, message: MESSAGE_BY_ERROR[result.error ?? ''] ?? 'Could not complete the purchase.' };
}

export { PASSPORT_TIERS };
