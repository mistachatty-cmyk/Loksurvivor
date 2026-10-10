/**
 * How 616 Survivor's cosmetics map onto the shared Lok catalog
 * (`lok_catalog`, sold for LokTokens). Prices here are PLACEHOLDERS -- edit the
 * table and re-run `scripts/export-lok-registry.ts` to change them; nothing
 * else needs to move. Documented in Lok-EcoSystsem/LokToken EcoSystem/LOKTOKEN_STORE.md.
 */
export type StoreItemKind = 'palette' | 'aura' | 'hat' | 'celebration' | 'dropPack' | 'passportTier';

/** Placeholder LokToken price by cosmetic tier. */
export const LOKTOKEN_PRICE_BY_TIER: Record<string, number> = {
  standard: 150,
  uncommon: 300,
  rare: 750,
  legendary: 1500,
};

/**
 * Kinds that can ONLY be bought with LokTokens (the local loot-token path is
 * closed for them). Add a kind here to move it over; anything already owned
 * stays owned. Right now: themes (world colour palettes), drop packs, and
 * the Operator Forge's Lok Passport slot tiers.
 */
export const LOKTOKEN_ONLY_KINDS: ReadonlySet<StoreItemKind> = new Set<StoreItemKind>(['palette', 'dropPack', 'passportTier']);

export const catalogSku = (kind: StoreItemKind, id: string) => `survivor616.${kind}.${id}`;

/**
 * The three Operator Forge slot-tier unlocks, sold as one-time LokToken
 * purchases (not a recurring charge -- this repo's LokToken economy is
 * earn-and-spend, not a billing processor; see
 * `.agents/memory/lok-passport-slots.md`). `skuId` is the catalog item id
 * (`catalogSku('passportTier', skuId)`); `metaFlag` is the `MetaState`
 * boolean it grants once owned.
 */
export interface PassportTierDef {
  skuId: 'lokpass' | 'lokpassport' | 'lifetime';
  metaFlag: 'lokPassOwned' | 'lokPassportActive' | 'lokPassportLifetime';
  name: string;
  blurb: string;
  /** Placeholder LokToken price -- the live `lok_catalog` price wins once seeded. */
  price: number;
}

export const PASSPORT_TIERS: PassportTierDef[] = [
  { skuId: 'lokpass', metaFlag: 'lokPassOwned', name: 'LokPass', blurb: 'Unlocks 6 more custom Operator Forge save slots, permanently.', price: 2000 },
  { skuId: 'lokpassport', metaFlag: 'lokPassportActive', name: 'Lok Passport', blurb: 'Unlocks 10 more custom Operator Forge save slots on top of LokPass, permanently.', price: 5000 },
  { skuId: 'lifetime', metaFlag: 'lokPassportLifetime', name: 'Lifetime Lok Passport', blurb: 'Unlocks the deepest batch of custom Operator Forge save slots, permanently.', price: 12000 },
];
