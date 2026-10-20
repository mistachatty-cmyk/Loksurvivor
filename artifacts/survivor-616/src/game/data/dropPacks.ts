import type { CosmeticTier } from '@/game/types';

/**
 * Drop packs: cosmetic art sets for every pickup (gems, coins, chests,
 * materials). Render-only -- a pack never changes what drops, how much, or
 * how the magnet and collection rules behave.
 *
 * `classic` is the art the game has always shipped, kept as the free
 * "Potato Pack" so nobody loses the original look. Every other pack is sold
 * for LokTokens (`LOKTOKEN_ONLY_KINDS` in lib/lokStoreCatalog.ts); tier sets
 * the placeholder price. `cost` only marks a pack as sellable (> 0) for the
 * registry export.
 */
export type DropStyle = 'classic' | 'toon' | 'realistic' | 'tech' | 'pixel' | 'blueprint' | 'neon' | 'paper';

export interface DropPackDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  tier: CosmeticTier;
  style: DropStyle;
}

export const DROP_PACKS: DropPackDef[] = [
  { id: 'potato', name: 'Potato Pack', description: 'The original drops, exactly as the game has always drawn them. Free, and it keeps the lowest cost on slow devices.', cost: 0, tier: 'standard', style: 'classic' },
  { id: 'pop-cut', name: 'Pop Cut Pack', description: 'Bright, bouncy and cartoon-clean: faceted gems, spinning coins, chests with rattling lids and glowing materials.', cost: 1, tier: 'standard', style: 'toon' },
  { id: 'paper-cut', name: 'Paper Cut Pack', description: 'Layered craft paper with hard little shadows, as if every drop were cut out and glued down.', cost: 1, tier: 'standard', style: 'paper' },
  { id: 'pixel-stash', name: 'Pixel Stash Pack', description: 'Hand-pixeled sprites on tight palettes, with a hard drop shadow and the odd twinkle.', cost: 1, tier: 'uncommon', style: 'pixel' },
  { id: 'blueprint', name: 'Blueprint Pack', description: 'Drafting-table schematics: pale linework on blue, marching dashed edges and a dimension tick under every part.', cost: 1, tier: 'uncommon', style: 'blueprint' },
  { id: 'salvage-grit', name: 'Salvage Grit Pack', description: 'Worn metal, glass, stone and wood with real shading and soft light. Gritty rather than glossy.', cost: 1, tier: 'rare', style: 'realistic' },
  { id: 'neon-arcade', name: 'Neon Arcade Pack', description: 'Dark glass shapes ringed in hot tube-light outlines that hum and flicker. Bright without being cartoonish.', cost: 1, tier: 'rare', style: 'neon' },
  { id: 'dark-circuit', name: 'Dark Circuit Pack', description: 'Matte hardware with thin glowing outlines and flickering readouts. Null Sector style.', cost: 1, tier: 'rare', style: 'tech' },
];

export const DROP_PACKS_BY_ID: Record<string, DropPackDef> = Object.fromEntries(DROP_PACKS.map((pack) => [pack.id, pack]));
export const DEFAULT_DROP_PACK_ID = 'potato';
export function getDropStyle(id: string): DropStyle {
  return DROP_PACKS_BY_ID[id]?.style ?? 'classic';
}
