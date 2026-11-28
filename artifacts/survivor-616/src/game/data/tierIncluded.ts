import { CELEBRATIONS } from '@/game/data/celebrations';
import { HATS } from '@/game/data/hats';
import { THEMED_PALETTES } from '@/game/data/themedPalettes';
import type { ActiveSupporterTier } from '@/game/data/lokShopPerks';

/**
 * Which cosmetics a supporter tier INCLUDES (owner plan, 2026-11-28; see Gsixhub docs/LOK_CUSTOMIZATION_TIER_MAP.md):
 *  - Passport includes every rare palette, hat and celebration (plus everything below it).
 *  - Lifetime includes every rare and legendary one.
 *  - Lok Pass includes none automatically (its "pick 3" is a later choice, not a blanket include).
 * It sits BESIDE LokToken sales (items stay buyable). It is pure data: nothing here changes a save file.
 * Wiring it into ownership needs one shared "effective owned ids" accessor first, because the palette gallery,
 * run setup and the meta store each read the owned lists directly.
 */
export type TierIncludedCatalog = 'palettes' | 'hats' | 'celebrations';

const CATALOGS: Record<TierIncludedCatalog, readonly { id: string; tier?: string }[]> = {
  palettes: THEMED_PALETTES,
  hats: HATS,
  celebrations: CELEBRATIONS,
};

/** The item rarities a tier includes. A lapsed or missing tier (null) includes nothing. */
export function includedRarities(active: ActiveSupporterTier): readonly string[] {
  if (active === 'lifetime') return ['rare', 'legendary'];
  if (active === 'passport') return ['rare'];
  return [];
}

export function tierIncludedIds(active: ActiveSupporterTier, catalog: TierIncludedCatalog): string[] {
  const rarities = includedRarities(active);
  return CATALOGS[catalog].filter((item) => item.tier !== undefined && rarities.includes(item.tier)).map((item) => item.id);
}

export function isTierIncluded(active: ActiveSupporterTier, catalog: TierIncludedCatalog, id: string): boolean {
  return tierIncludedIds(active, catalog).includes(id);
}
