// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
/**
 * The perk shelf: what each paid tier actually gives, per app, as DATA. Apps read this to unlock things,
 * the hub reads it to show what a tier includes, and the owner reads the `status` column to see what still
 * has to be built before a tier is worth selling. Adding a perk means adding a row, never editing app logic.
 *
 * Statuses are honest: "live" means it works in a shipped build today, "planned" means it is promised in
 * the tier plan but not built. `unverified` perks were written from the docs, not checked in the app.
 * Prices and tier rules: gsix-brain/Business/Tiers and Pricing.md. Tier ladder: billing.ts.
 */
import type { PassTier } from "./billing";

export type PerkKind = "ads_off" | "theme" | "title" | "cosmetic" | "storage" | "qol" | "collab" | "founder" | "keepsake";
export type PerkStatus = "live" | "planned";

export interface Perk {
  id: string;
  /** "all" = every app, otherwise an app key from apps.ts. */
  app: string;
  /** The lowest tier that unlocks it; higher tiers keep it. */
  tier: Exclude<PassTier, "free">;
  kind: PerkKind;
  name: string;
  status: PerkStatus;
  /** Only true when someone has confirmed it in the running app. */
  verified?: boolean;
  note?: string;
}

/** Every app gets these three, so a tier is never empty on day one. */
export const UNIVERSAL_PERKS: Perk[] = [
  { id: "all-ads-off", app: "all", tier: "pass", kind: "ads_off", name: "No ads in this app (Passport and Lifetime: everywhere)", status: "planned", note: "Ads are not live yet; the check is one shared function (adsOff in billing.ts) so it works the day ads arrive." },
  { id: "all-supporter-bar", app: "all", tier: "pass", kind: "cosmetic", name: "Your name on the supporter thank-you bar", status: "planned", note: "Bar and feed SQL exist (08_supporters.sql) but that SQL is not applied live yet." },
  { id: "all-theme-neon", app: "all", tier: "passport", kind: "theme", name: "Neon LOK theme", status: "planned" },
  { id: "all-theme-gold", app: "all", tier: "passport", kind: "theme", name: "Passkey Gold theme", status: "planned" },
  { id: "all-theme-eclipse", app: "all", tier: "passport", kind: "theme", name: "Eclipse theme", status: "planned" },
  { id: "all-founder-mark", app: "all", tier: "lifetime", kind: "founder", name: "Founder mark on your profile and the supporter bar", status: "planned" },
  { id: "hub-bounce-fx", app: "gsix", tier: "pass", kind: "cosmetic", name: "Tier-colored Tamagotchi bounce effects", status: "live", verified: false, note: "Merged in the hub; colors per tier, never checked on a real device." },
  { id: "hub-skin-chapter-drift", app: "gsix", tier: "pass", kind: "theme", name: "Chapter Drift background skin", status: "live", verified: false, note: "Gated in packages/lok-skins catalog (min lokpass); not checked with a real Pass." },
  { id: "hub-badge-pass-holder", app: "gsix", tier: "pass", kind: "cosmetic", name: "Pass Holder profile badge", status: "live", verified: false, note: "Gated in the same catalog." },
  { id: "hub-skin-lok-teal", app: "gsix", tier: "passport", kind: "theme", name: "Lok Teal background skin", status: "live", verified: false, note: "Gated at lokpassport in lok-skins." },
  { id: "hub-badge-passport", app: "gsix", tier: "passport", kind: "cosmetic", name: "Passport profile badge", status: "live", verified: false },
  { id: "hub-skin-passkey-aurora", app: "gsix", tier: "lifetime", kind: "theme", name: "Passkey Aurora background skin", status: "live", verified: false, note: "Gated at lifetime in lok-skins." },
  { id: "hub-badge-lifetime", app: "gsix", tier: "lifetime", kind: "founder", name: "Lifetime profile badge", status: "live", verified: false },
  { id: "all-keepsakes-lifetime", app: "all", tier: "lifetime", kind: "keepsake", name: "Yearly keepsakes (2 Spark and 1 Deep World)", status: "planned", note: "Hand made: needs the fulfillment rules and a seat cap before it is sold." },
];

/** Per-app perks known from the tier plan and the code. Add more rows as each app's shelf is stocked. */
export const APP_PERKS: Perk[] = [
  { id: "survivor616-slots-pass", app: "survivor616", tier: "pass", kind: "storage", name: "+6 Operator Forge slots", status: "live", verified: false, note: "Slot table exists in endgameUnlocks.ts; 8 free, +6 Pass, +10 Passport, +10 Lifetime." },
  { id: "survivor616-slots-passport", app: "survivor616", tier: "passport", kind: "storage", name: "+10 Operator Forge slots", status: "live", verified: false },
  { id: "survivor616-slots-lifetime", app: "survivor616", tier: "lifetime", kind: "storage", name: "+10 more Operator Forge slots, then future batches", status: "live", verified: false },
  { id: "survivor616-pass-picks", app: "survivor616", tier: "pass", kind: "cosmetic", name: "Pass pick: choose 3 rare cosmetics (palettes, hats, celebrations) to own for good", status: "planned", note: "Uses stock that already exists; only the shop check is new. PROPOSED." },
  { id: "survivor616-passport-rare", app: "survivor616", tier: "passport", kind: "cosmetic", name: "Every rare cosmetic included (about 39: 28 palettes, 8 hats, 3 celebrations)", status: "planned", note: "Existing items; needs the tier check in the shop and an owner decision on LokToken sales. PROPOSED." },
  { id: "survivor616-lifetime-legendary", app: "survivor616", tier: "lifetime", kind: "cosmetic", name: "Every legendary cosmetic included (about 37: 32 palettes, 4 hats, 1 celebration)", status: "planned", note: "Existing items. PROPOSED." },
  { id: "lokbook-gallery", app: "lokbook", tier: "pass", kind: "storage", name: "50 flipbooks in the cloud gallery (free 20; Passport 250; Lifetime 1,000)", status: "planned" },
  { id: "loklingu-lists", app: "loklingu", tier: "pass", kind: "storage", name: "5 custom word lists (free 2; Passport and Lifetime unlimited, fair use)", status: "planned" },
  { id: "pongfall-replays", app: "pongfall", tier: "pass", kind: "storage", name: "10 saved replays (free 3; Passport 50; Lifetime 200)", status: "planned" },
  { id: "qnk-maps", app: "queens-n-kings", tier: "pass", kind: "storage", name: "10 custom maps (free 3; Passport 50; Lifetime 200)", status: "planned" },
];

export const ALL_PERKS: Perk[] = [...UNIVERSAL_PERKS, ...APP_PERKS];

const RANK: Record<Perk["tier"], number> = { pass: 1, passport: 2, lifetime: 3 };
const HAVE: Record<PassTier, number> = { free: 0, pass: 1, passport: 2, lifetime: 3 };

/** The perks a tier unlocks in one app (its own plus the universal ones). A higher tier keeps everything below it. */
export function perksFor(tier: PassTier, appKey: string, perks: readonly Perk[] = ALL_PERKS): Perk[] {
  return perks.filter((p) => (p.app === "all" || p.app === appKey) && RANK[p.tier] <= HAVE[tier]);
}

/** What the owner still has to build before a tier is worth selling in an app: perks promised but not live. */
export function shelfGaps(appKey: string, perks: readonly Perk[] = ALL_PERKS): Record<Perk["tier"], number> {
  const out = { pass: 0, passport: 0, lifetime: 0 };
  for (const p of perks) if ((p.app === "all" || p.app === appKey) && p.status === "planned") out[p.tier]++;
  return out;
}

/** The bar a tier must clear in an app before its sale switch should go on: live perks, counting the universal ones. */
export const MIN_SHELF: Record<Perk["tier"], number> = { pass: 3, passport: 5, lifetime: 2 };

export interface ShelfStatus {
  live: number;
  planned: number;
  need: number;
  ready: boolean;
}

/** Per tier, how many perks (that tier's own, not inherited) are live, how many are only promised, and whether the bar is met. */
export function shelfStatus(appKey: string, perks: readonly Perk[] = ALL_PERKS): Record<Perk["tier"], ShelfStatus> {
  const out = {} as Record<Perk["tier"], ShelfStatus>;
  for (const tier of ["pass", "passport", "lifetime"] as const) {
    const mine = perks.filter((p) => (p.app === "all" || p.app === appKey) && RANK[p.tier] <= RANK[tier]);
    const live = mine.filter((p) => p.status === "live").length;
    out[tier] = { live, planned: mine.length - live, need: MIN_SHELF[tier], ready: live >= MIN_SHELF[tier] };
  }
  return out;
}
