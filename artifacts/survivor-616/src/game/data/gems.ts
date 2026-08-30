import type { GemPaletteItemDef, GemRarity } from '@/game/types';

/** Weakest to strongest/rarest. */
export const GEM_RARITY_ORDER: GemRarity[] = ['blue', 'purple', 'gold', 'red', 'white'];

export const GEM_RARITY_LABELS: Record<GemRarity, string> = {
  blue: 'Blue',
  purple: 'Purple',
  gold: 'Gold',
  red: 'Red',
  white: 'White',
};

export const GEM_RARITY_COLORS: Record<GemRarity, string> = {
  blue: '#38bdf8',
  purple: '#c084fc',
  gold: '#fbbf24',
  red: '#f87171',
  white: '#f8fafc',
};

/** World-space draw radius; visually ties gem size to the dropping enemy's tier. */
export const GEM_RADIUS_BY_RARITY: Record<GemRarity, number> = {
  blue: 5,
  purple: 6.5,
  gold: 8,
  red: 9.5,
  white: 11,
};

/** Loot tokens granted immediately on pickup -- gems feed the same currency loot boxes and objectives already pay into. */
export const GEM_RARITY_LOOT_TOKENS: Record<GemRarity, number> = {
  blue: 1,
  purple: 3,
  gold: 8,
  red: 20,
  white: 50,
};

type GemDropTier = 'common' | 'uncommon' | 'elite' | 'boss';

/** Authoring helper for `EnemyDef.gemDropTable` -- cuts down per-record boilerplate, same spirit as `characters.ts`'s `palette()`. */
export function gemDrops(tier: GemDropTier): Partial<Record<GemRarity, number>> {
  switch (tier) {
    case 'common':
      return { blue: 0.12 };
    case 'uncommon':
      return { blue: 0.2, purple: 0.05 };
    case 'elite':
      return { blue: 0.3, purple: 0.15, gold: 0.05 };
    case 'boss':
      return { blue: 1, purple: 0.7, gold: 0.4, red: 0.18, white: 0.05 };
    default:
      return {};
  }
}

/** One recolor cosmetic per rarity tier, priced in loot tokens. Permanent unlocks -- no refund, same as UI themes. */
export const GEM_PALETTE_ITEMS: GemPaletteItemDef[] = [
  {
    id: 'gem-palette-blue',
    rarity: 'blue',
    name: 'Blue Cut',
    description: 'Recolors gem pickups and their HUD ticker to a cold blue cut.',
    cost: 150,
  },
  {
    id: 'gem-palette-purple',
    rarity: 'purple',
    name: 'Purple Cut',
    description: 'Recolors gem pickups and their HUD ticker to a violet cut.',
    cost: 400,
  },
  {
    id: 'gem-palette-gold',
    rarity: 'gold',
    name: 'Gold Cut',
    description: 'Recolors gem pickups and their HUD ticker to a gold cut.',
    cost: 1_200,
  },
  {
    id: 'gem-palette-red',
    rarity: 'red',
    name: 'Red Cut',
    description: 'Recolors gem pickups and their HUD ticker to a red cut.',
    cost: 3_500,
  },
  {
    id: 'gem-palette-white',
    rarity: 'white',
    name: 'White Cut',
    description: 'Recolors gem pickups and their HUD ticker to a white cut. The rarest finish in the case.',
    cost: 10_000,
  },
];

export const GEM_PALETTE_ITEMS_BY_ID: Record<string, GemPaletteItemDef> = Object.fromEntries(
  GEM_PALETTE_ITEMS.map((item) => [item.id, item]),
);
