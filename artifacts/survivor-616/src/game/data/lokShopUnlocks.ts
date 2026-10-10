import type { StoreItemKind } from '@/lib/lokStoreCatalog';

/**
 * Account-wide feature unlocks sold for LokTokens in the Lok Shop, distinct
 * from the cosmetic catalog (palettes/auras/hats/celebrations/drop packs):
 * these flip a permanent MetaState boolean rather than add to an owned-ids
 * array or get equipped. See metaStore.tsx's `grantLokPetFieldGuide` /
 * `grantLokPetCollectorAccess` reducer cases.
 */
export interface LokShopUnlockDef {
  id: string;
  kind: StoreItemKind;
  name: string;
  description: string;
  tier: 'rare' | 'legendary';
  /** LokToken-only (see LOKTOKEN_ONLY_KINDS) -- this exists only so the item fits the shared
   * export script's generic `Priced` shape (its `cost > 0` filter); the live price is `tier`. */
  cost: number;
}

export const LOK_SHOP_UNLOCKS: LokShopUnlockDef[] = [
  {
    id: 'field-guide',
    kind: 'fieldGuideUnlock',
    name: 'LokPet Field Guide',
    description: 'Unlocks the full LokPet field guide in Character Select -- every variant, family and silhouette catalogued.',
    tier: 'rare',
    cost: 750,
  },
  {
    id: 'collector-access',
    kind: 'collectorAccess',
    name: 'LokPet Collector Access',
    description: 'Unlocks the LokPet Collector character line once their own in-game challenge is also met -- extra team slots, better pulls, bonus card credits per loot box.',
    tier: 'legendary',
    cost: 1500,
  },
  {
    id: 'faction-races',
    kind: 'factionRacesUnlock',
    name: 'Faction Races Pass',
    description: 'Unlocks the Operator Forge\'s faction races (Watchborn, Nullborn, and the rest) before clearing every standard map would otherwise earn them.',
    tier: 'rare',
    cost: 750,
  },
];

export const LOK_SHOP_UNLOCKS_BY_ID: Record<string, LokShopUnlockDef> = Object.fromEntries(
  LOK_SHOP_UNLOCKS.map((entry) => [entry.id, entry]),
);
