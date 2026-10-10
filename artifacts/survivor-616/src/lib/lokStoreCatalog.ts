/**
 * How 616 Survivor's cosmetics map onto the shared Lok catalog
 * (`lok_catalog`, sold for LokTokens). Prices here are PLACEHOLDERS -- edit the
 * table and re-run `scripts/export-lok-registry.ts` to change them; nothing
 * else needs to move. Documented in Lok-EcoSystsem/LokToken EcoSystem/LOKTOKEN_STORE.md.
 */
export type StoreItemKind = 'palette' | 'aura' | 'hat' | 'celebration' | 'dropPack' | 'fieldGuideUnlock' | 'collectorAccess' | 'packVisualizerUnlock';

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
 * the two feature unlocks (field guide, Collector access) -- there is no
 * local-currency fallback for either, by design.
 */
export const LOKTOKEN_ONLY_KINDS: ReadonlySet<StoreItemKind> = new Set<StoreItemKind>(['palette', 'dropPack', 'fieldGuideUnlock', 'collectorAccess', 'packVisualizerUnlock']);

export const catalogSku = (kind: StoreItemKind, id: string) => `survivor616.${kind}.${id}`;
