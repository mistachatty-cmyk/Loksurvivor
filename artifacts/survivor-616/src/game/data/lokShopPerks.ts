import type { StoreItemKind } from '@/lib/lokStoreCatalog';

/**
 * LokToken-only perks sold by LokServer. Unlike `lokShopUnlocks.ts` (one MetaState boolean
 * each), these all live in `MetaState.lokShopPerks` as owned ids, so a new perk is a record
 * here plus a line in `perkEffects` -- not a new reducer case.
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
    id: 'lok-pass',
    kind: 'perkUnlock',
    name: 'Lok Pass',
    description: 'LokServer lets you try the feather game three times a day instead of once, and keeps the back room open to you.',
    tier: 'rare',
    cost: 750,
  },
  {
    id: 'lok-passport',
    kind: 'perkUnlock',
    name: 'Lok Passport',
    description: 'A stamp book LokServer fills in on every visit. Each stamp earns rapport, and Feather Charms turn up twice as often.',
    tier: 'legendary',
    cost: 1500,
  },
  {
    id: 'lifetime-passport',
    kind: 'perkUnlock',
    name: 'Lifetime Passport',
    description: 'Counts as the Lok Pass and the Lok Passport together, forever, plus a gold stamp and a seat at the back-room table.',
    tier: 'legendary',
    cost: 1500,
  },
];

export const LOK_SHOP_PERKS_BY_ID: Record<string, LokShopPerkDef> = Object.fromEntries(LOK_SHOP_PERKS.map((p) => [p.id, p]));

export interface PerkEffects {
  passport: boolean;
  pass: boolean;
}

export function perkEffects(owned: readonly string[]): PerkEffects {
  const lifetime = owned.includes('lifetime-passport');
  return { passport: lifetime || owned.includes('lok-passport'), pass: lifetime || owned.includes('lok-pass') };
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
export function backRoomOpen(rapport: number, owned: readonly string[]): boolean {
  const fx = perkEffects(owned);
  return rapportTier(rapport).index >= 2 || fx.pass || fx.passport;
}

export function haggleAttemptsPerDay(owned: readonly string[]): number {
  return perkEffects(owned).pass ? 3 : 1;
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
  owned: readonly string[],
  rng: () => number,
): HaggleOutcome {
  const win = pick === goldenSlot;
  const missing = FEATHER_CHARMS.filter((c) => !ownedCharms.includes(c.id));
  const chance = (win ? CHARM_BASE_CHANCE : 0) * (perkEffects(owned).passport ? 2 : 1);
  const charm = missing.length > 0 && rng() < chance ? missing[Math.floor(rng() * missing.length)]! : null;
  return { win, rapport: win ? 3 : 1, charmId: charm?.id ?? null };
}
