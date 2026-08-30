/**
 * Reference pricing table for `VendorItemDef.tierBand`/`tierRung`. A tree
 * picks a band per node based on how run-altering it is; `cost` on the item
 * itself stays the source of truth for what the player actually pays -- this
 * table is metadata for shop UI grouping and for validating that new content
 * lands on-scale, per `.agents/memory/kinetic-bender-progression.md` §2.
 */
import type { VendorItemDef } from '@/game/types';

export interface ShopTierRungDef {
  band: NonNullable<VendorItemDef['tierBand']>;
  rung: number;
  /** Reference cred cost new content at this rung should target. A range for the top medium rung. */
  costMin: number;
  costMax: number;
  label: string;
}

export const SHOP_TIERS: ShopTierRungDef[] = [
  { band: 'low', rung: 1, costMin: 2_000, costMax: 2_000, label: 'Low tier · Rung 1' },
  { band: 'low', rung: 2, costMin: 8_000, costMax: 8_000, label: 'Low tier · Rung 2' },
  { band: 'medium', rung: 1, costMin: 50_000, costMax: 50_000, label: 'Medium tier · Rung 1' },
  { band: 'medium', rung: 2, costMin: 250_000, costMax: 250_000, label: 'Medium tier · Rung 2' },
  { band: 'medium', rung: 3, costMin: 750_000, costMax: 1_000_000, label: 'Medium tier · Rung 3' },
];

function tierKey(band: string, rung: number): string {
  return `${band}:${rung}`;
}

export const SHOP_TIERS_BY_KEY: Record<string, ShopTierRungDef> = Object.fromEntries(
  SHOP_TIERS.map((tier) => [tierKey(tier.band, tier.rung), tier]),
);

export function shopTierFor(item: Pick<VendorItemDef, 'tierBand' | 'tierRung'>): ShopTierRungDef | undefined {
  if (!item.tierBand || !item.tierRung) return undefined;
  return SHOP_TIERS_BY_KEY[tierKey(item.tierBand, item.tierRung)];
}
