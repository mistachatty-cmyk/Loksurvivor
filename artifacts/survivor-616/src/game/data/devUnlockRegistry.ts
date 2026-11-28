import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { RUN_AURAS } from '@/game/data/runAuras';
import { HATS } from '@/game/data/hats';
import { CELEBRATIONS } from '@/game/data/celebrations';
import { DROP_PACKS } from '@/game/data/dropPacks';
import { THEMED_PALETTES } from '@/game/data/themedPalettes';
import { SOUND_PACKS } from '@/game/data/soundPacks';
import { UI_THEMES } from '@/game/data/uiThemes';
import { HUB_ROOMS } from '@/game/data/progression';
import type { MetaState } from '@/game/types';
import { isTierIncluded, tierIncludedIds, type TierIncludedCatalog } from '@/game/data/tierIncluded';

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
  soundPacks: SOUND_PACKS.map((item) => item.id),
  runAuras: RUN_AURAS.map((item) => item.id),
  hats: HATS.map((item) => item.id),
  celebrations: CELEBRATIONS.map((item) => item.id),
  dropPacks: DROP_PACKS.map((item) => item.id),
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

type OwnershipMeta = Pick<MetaState, 'devModeAllUnlocks'> & Partial<Pick<MetaState, 'activeSupporterTier'>>;

const TIER_CATALOGS: readonly TierIncludedCatalog[] = ['palettes', 'hats', 'celebrations'];
const tierCatalog = (catalog: DevUnlockCatalog): TierIncludedCatalog | null => (TIER_CATALOGS as readonly string[]).includes(catalog) ? (catalog as TierIncludedCatalog) : null;

/** Everything the player can use right now: what they own, plus what their ACTIVE supporter tier includes. Dev Mode shows all. */
export function effectiveCatalogIds(
  meta: OwnershipMeta,
  catalog: DevUnlockCatalog,
  ownedIds: string[],
): string[] {
  if (meta.devModeAllUnlocks) return [...DEV_UNLOCK_REGISTRY[catalog]];
  const included = tierCatalog(catalog) ? tierIncludedIds(meta.activeSupporterTier ?? null, tierCatalog(catalog)!) : [];
  return included.length ? [...new Set([...ownedIds, ...included])] : ownedIds;
}

export function hasCatalogItem(
  meta: OwnershipMeta,
  catalog: DevUnlockCatalog,
  id: string,
  ownedIds: string[],
): boolean {
  if (meta.devModeAllUnlocks) return DEV_UNLOCK_REGISTRY[catalog].includes(id as never);
  if (ownedIds.includes(id)) return true;
  const tc = tierCatalog(catalog);
  return tc ? isTierIncluded(meta.activeSupporterTier ?? null, tc, id) : false;
}

export const DEV_ACCESS_TAPS_REQUIRED = 4;

export function advanceDevAccessTap(currentTaps: number): { taps: number; unlocked: boolean } {
  const taps = Math.min(DEV_ACCESS_TAPS_REQUIRED, Math.max(0, Math.floor(currentTaps)) + 1);
  return { taps, unlocked: taps >= DEV_ACCESS_TAPS_REQUIRED };
}
