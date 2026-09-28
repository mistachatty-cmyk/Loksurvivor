import { WEIRD_AREAS } from './areas-weird';
import type { AreaDef } from '@/game/types';

export type AreaCategory = 'standard' | 'bonus' | '2x' | 'classic' | 'endless';

const BONUS_AREA_IDS = new Set(WEIRD_AREAS.map((area) => area.id));

export function areaCategory(area: AreaDef): AreaCategory {
  if (area.endless) return 'endless';
  if (area.id.endsWith('-classic')) return 'classic';
  if (area.id.endsWith('-2x')) return '2x';
  if (BONUS_AREA_IDS.has(area.id)) return 'bonus';
  return 'standard';
}

export function areasInCategory(areas: readonly AreaDef[], category: AreaCategory): AreaDef[] {
  return areas.filter((area) => areaCategory(area) === category);
}
