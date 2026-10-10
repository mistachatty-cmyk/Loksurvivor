/**
 * The contract this repo's Lok Shop UI needs from the Lok ecosystem's real
 * purchase processing. No payment processor (Stripe or otherwise) lives in
 * this repo: `loksurvivor` only has access to this one game's codebase, not
 * the Lok platform services (lok lingu, kinetic souls, lokbook) that would
 * own an actual charge. See `.agents/memory/lok-passport-slots.md` for the
 * full contract this function stands in for.
 *
 * Until that's wired up, `requestLokPassportPurchase` only grants the
 * entitlement when Dev Mode's "all unlocks" is on (for testing the gated
 * slot tiers), and otherwise reports that purchasing isn't live yet.
 */
export type LokPassportTier = 'lokPassOwned' | 'lokPassportActive' | 'lokPassportLifetime';

export interface LokPassportPurchaseResult {
  ok: boolean;
  message: string;
}

export function requestLokPassportPurchase(
  tier: LokPassportTier,
  devModeAllUnlocks: boolean,
  grant: (tier: LokPassportTier, enabled: boolean) => void,
): LokPassportPurchaseResult {
  if (devModeAllUnlocks) {
    grant(tier, true);
    return { ok: true, message: 'Granted via Dev Mode for testing. No real purchase was made.' };
  }
  return { ok: false, message: "Purchasing isn't live yet -- check back soon." };
}
