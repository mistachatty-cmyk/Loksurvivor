import { WEIRD_AREAS, BONUS_DIGIVERSE_AREAS } from './areas-weird';
import type { AreaDef } from '@/game/types';

export type AreaCategory = 'standard' | 'bonus' | '2x' | '4x' | 'classic' | 'endless';

const BONUS_AREA_IDS = new Set([...WEIRD_AREAS, ...BONUS_DIGIVERSE_AREAS].map((area) => area.id).concat(['floodline-breach', 'glassroot-annex', 'gen-fitting-floor']));

export function areaCategory(area: AreaDef): AreaCategory {
  if (area.endless) return 'endless';
  if (area.id.endsWith('-classic')) return 'classic';
  if (area.id.endsWith('-2x')) return '2x';
  if (area.id.endsWith('-4x')) return '4x';
  if (BONUS_AREA_IDS.has(area.id)) return 'bonus';
  return 'standard';
}

export function areasInCategory(areas: readonly AreaDef[], category: AreaCategory): AreaDef[] {
  return areas.filter((area) => areaCategory(area) === category);
}
