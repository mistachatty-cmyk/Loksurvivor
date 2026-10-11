import type { StoreItemKind } from '@/lib/lokStoreCatalog';

/**
 * LokToken-only perks sold by LokServer. Unlike `lokShopUnlocks.ts` (one MetaState boolean
 * each), these all live in `MetaState.lokShopPerks` as owned ids, so a new perk is a record
 * here plus its effect where it applies -- not a new reducer case.
 */
export interface LokShopPerkDef {
  id: string;
  kind: StoreItemKind;
  name: string;
  description: string;
  tier: 'rare' | 'legendary';
  /** Exists only for the shared export script's `cost > 0` filter; the live price is `tier`. */
  cost: number;
}

export const LOK_SHOP_PERKS: LokShopPerkDef[] = [
  {
    id: 'ball',
    kind: 'perkUnlock',
    name: 'The Ball',
    description: 'Drops on the ground in the hideout. Click it, your character throws it, and your LokPets race for it.',
    tier: 'rare',
    cost: 750,
  },
  {
    id: 'chest-pass',
    kind: 'perkUnlock',
    name: 'Chest Pass',
    description: 'The Lucky Chest turns up in about three out of four windows instead of two out of five. Daily reward limits still apply.',
    tier: 'rare',
    cost: 750,
  },
  {
    id: 'rider-saddle',
    kind: 'perkUnlock',
    name: 'Rider Saddle',
    description: 'Your lead LokPet rides on your back during runs and attacks 20% faster.',
    tier: 'legendary',
    cost: 1500,
  },
];

export const LOK_SHOP_PERKS_BY_ID: Record<string, LokShopPerkDef> = Object.fromEntries(LOK_SHOP_PERKS.map((p) => [p.id, p]));

/**
 * Supporter tiers are NOT LokShop purchases: Lok Pass, Lok Passport and the Lifetime Passport
 * are entitlements (see `LokToken EcoSystem/08_supporters.sql`). `active` is the highest tier
 * with a live entitlement; Lifetime never lapses and counts as every tier below it.
 */
export type ActiveSupporterTier = 'pass' | 'passport' | 'lifetime' | null;

export interface PerkEffects {
  passport: boolean;
  pass: boolean;
}

export function perkEffects(active: ActiveSupporterTier): PerkEffects {
  return { passport: active === 'passport' || active === 'lifetime', pass: active !== null };
}

export const RAPPORT_TIERS = [
  { min: 0, id: 'stranger' },
  { min: 5, id: 'regular' },
  { min: 15, id: 'favorite' },
  { min: 30, id: 'confidant' },
] as const;
export type RapportTier = (typeof RAPPORT_TIERS)[number]['id'];

export function rapportTier(rapport: number): { id: RapportTier; index: number; next: number | null } {
  let index = 0;
  RAPPORT_TIERS.forEach((tier, i) => { if (rapport >= tier.min) index = i; });
  return { id: RAPPORT_TIERS[index]!.id, index, next: RAPPORT_TIERS[index + 1]?.min ?? null };
}

/** The back room opens at Favorite rapport, or with the Pass / Passport. */
export function backRoomOpen(rapport: number, active: ActiveSupporterTier): boolean {
  return rapportTier(rapport).index >= 2 || perkEffects(active).pass;
}

export function haggleAttemptsPerDay(active: ActiveSupporterTier): number {
  return perkEffects(active).pass ? 3 : 1;
}

export interface FeatherCharmDef { id: string; name: string; color: string; blurb: string }

/** The shop-exclusive collection. Finishing the set makes you the owl's Confidant. */
export const FEATHER_CHARMS: FeatherCharmDef[] = [
  { id: 'dusk', name: 'Dusk Feather', color: '#a78bfa', blurb: 'Dyed by the last light before the eclipse.' },
  { id: 'static', name: 'Static Feather', color: '#67e8f9', blurb: 'Crackles when the shop is quiet.' },
  { id: 'ember', name: 'Ember Feather', color: '#fb923c', blurb: 'Warm. Do not ask where it was found.' },
  { id: 'glyph', name: 'Glyph Feather', color: '#f0abfc', blurb: 'A sky-glyph is printed along the vane.' },
  { id: 'ledger', name: 'Ledger Feather', color: '#fde047', blurb: 'The owl swears it was a receipt once.' },
  { id: 'hollow', name: 'Hollow Feather', color: '#e2e8f0', blurb: 'Weighs nothing and hums faintly.' },
];

export const CHARM_BASE_CHANCE = 0.4;

export interface HaggleOutcome { win: boolean; rapport: number; charmId: string | null }

/** One feather pick. `goldenSlot` is the winning feather of three; `pick` is the player's choice. */
export function resolveHaggle(
  pick: number,
  goldenSlot: number,
  ownedCharms: readonly string[],
  active: ActiveSupporterTier,
  rng: () => number,
): HaggleOutcome {
  const win = pick === goldenSlot;
  const missing = FEATHER_CHARMS.filter((c) => !ownedCharms.includes(c.id));
  const chance = (win ? CHARM_BASE_CHANCE : 0) * (perkEffects(active).passport ? 2 : 1);
  const charm = missing.length > 0 && rng() < chance ? missing[Math.floor(rng() * missing.length)]! : null;
  return { win, rapport: win ? 3 : 1, charmId: charm?.id ?? null };
}
