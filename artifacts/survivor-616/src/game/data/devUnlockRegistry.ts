import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { RUN_AURAS } from '@/game/data/runAuras';
import { THEMED_PALETTES } from '@/game/data/themedPalettes';
import { UI_THEMES } from '@/game/data/uiThemes';
import { HUB_ROOMS } from '@/game/data/progression';
import type { MetaState } from '@/game/types';

/**
 * One registration point for catalogs that Dev Mode should expose. Adding a
 * future customization type here makes it discoverable to tests and tooling.
 */
export const DEV_UNLOCK_REGISTRY = {
  characters: CHARACTERS.map((item) => item.id),
  areas: AREAS.map((item) => item.id),
  rooms: HUB_ROOMS.map((item) => item.id),
  uiThemes: UI_THEMES.map((item) => item.id),
  palettes: THEMED_PALETTES.map((item) => item.id),
  runAuras: RUN_AURAS.map((item) => item.id),
} as const;

export type DevUnlockCatalog = keyof typeof DEV_UNLOCK_REGISTRY;

export interface DevRunToolDefinition {
  id: string;
  label: string;
  description: string;
  presentationOnly: true;
}
/** Run-only diagnostics register here and never add permanent save flags. */
export const DEV_RUN_TOOL_REGISTRY = [
  {
    id: 'run-hud-stress',
    label: 'HUD stress preview',
    description: 'Outline every reserved HUD zone and open the compact drawers without changing the run.',
    presentationOnly: true,
  },
] as const satisfies readonly DevRunToolDefinition[];

export type DevRunToolId = (typeof DEV_RUN_TOOL_REGISTRY)[number]['id'];

export function effectiveCatalogIds(
  meta: Pick<MetaState, 'devModeAllUnlocks'>,
  catalog: DevUnlockCatalog,
  ownedIds: string[],
): string[] {
  return meta.devModeAllUnlocks ? [...DEV_UNLOCK_REGISTRY[catalog]] : ownedIds;
}

export function hasCatalogItem(
  meta: Pick<MetaState, 'devModeAllUnlocks'>,
  catalog: DevUnlockCatalog,
  id: string,
  ownedIds: string[],
): boolean {
  return meta.devModeAllUnlocks
    ? DEV_UNLOCK_REGISTRY[catalog].includes(id as never)
    : ownedIds.includes(id);
}

export const DEV_ACCESS_TAPS_REQUIRED = 4;

export function advanceDevAccessTap(currentTaps: number): { taps: number; unlocked: boolean } {
  const taps = Math.min(DEV_ACCESS_TAPS_REQUIRED, Math.max(0, Math.floor(currentTaps)) + 1);
  return { taps, unlocked: taps >= DEV_ACCESS_TAPS_REQUIRED };
}
