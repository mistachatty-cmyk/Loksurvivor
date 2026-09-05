/**
 * Persistent meta progression.
 *
 * Everything the player keeps between runs -- unlocked characters, cleared
 * areas, rescued allies, discoveries, bestiary counts -- lives here and is
 * mirrored into localStorage so a refresh does not wipe the hideout.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';

import { AREAS, getArea } from '@/game/data/areas';
import { CHARACTERS, getCharacter } from '@/game/data/characters';
import { CHARACTER_EPISODES, CHARACTER_EPISODES_BY_ID } from '@/game/data/episodes';
import { getCharacterSkins } from '@/game/data/characterSkins';
import { EVOLUTIONS_BY_ID } from '@/game/data/evolutions';
import { CITY_RELICS, RELIC_BY_DISCOVERY_ID } from '@/game/data/relics';
import { ENEMIES } from '@/game/data/enemies';
import { LOKPET_VARIANTS_BY_ID } from '@/game/data/lokPets';
import { ALLIES, ALLIES_BY_ID, DISCOVERIES, HUB_ROOMS } from '@/game/data/progression';
import {
  crewActivityEffects,
  normalizeCrewActivities,
  rollCrewActivities,
} from '@/game/data/crewActivities';
import {
  normalizeActiveCrewRumor,
  rollCrewRumor,
} from '@/game/data/crewRumors';
import {
  RECOVERY_FACILITIES,
  RECOVERY_FACILITIES_BY_ID,
  RECOVERY_HUTS,
} from '@/game/data/recovery';
import { VENDOR_CATALOG, VENDOR_CATALOG_BY_ID, vendorPurchaseCount } from '@/game/data/vendor';
import {
  advanceDailyContracts,
  contractDayKey,
  dailyContractDefs,
  dailyContractStatuses,
} from '@/game/data/contracts';
import {
  DEFAULT_UI_THEME_ID,
  UI_THEMES_BY_ID,
  defaultSwatchId,
  uiLooksForOwnedThemeIds,
} from '@/game/data/uiThemes';
import { DEFAULT_PALETTE_ID, THEMED_PALETTES_BY_ID } from '@/game/data/themedPalettes';
import { DEFAULT_RUN_AURA_ID, RUN_AURAS, RUN_AURAS_BY_ID } from '@/game/data/runAuras';
import { DEFAULT_HAT_ID, HATS, HATS_BY_ID } from '@/game/data/hats';
import { CELEBRATIONS, CELEBRATIONS_BY_ID, DEFAULT_CELEBRATION_ID } from '@/game/data/celebrations';
import { effectiveCatalogIds, hasCatalogItem } from '@/game/data/devUnlockRegistry';
import { ENDLESS_BANDS } from '@/game/data/endlessBands';
import { MAX_CUSTOM_MAPS, normalizeCustomMap, normalizeCustomMaps } from '@/game/data/customMaps';
import type {
  AllyDef,
  AreaDef,
  BaseStats,
  CharacterEpisodeDef,
  CharacterDef,
  HubRoomDef,
  LokPetAttackKind,
  LokPetCatalogEntry,
  LokPetCatalogTrait,
  LokPetDiscoveryHistoryEntry,
  LokPetElement,
  LokPetRarity,
  LokPetRunDiscovery,
  SavedLokPet,
  MetaState,
  RunResult,
  FacilityTier,
  RecoverySession,
  StealthAbilityConfig,
  ThemedPaletteDef,
  UnlockRule,
  CustomMap,
  UIPanelLayout,
} from '@/game/types';

const STORAGE_KEY = 'survivor616.meta.v1';
const META_VERSION = 15;
export const MAX_FATIGUE_PCT = 5;
export const FATIGUE_PER_RUN_PCT = 0.5;

const FACILITY_ORDER: FacilityTier[] = RECOVERY_FACILITIES.map((facility) => facility.id);

function defaultRecovery(): RecoverySession {
  return { characterId: null, locationId: 'rooftop', startedAt: null, lastUpdatedAt: Date.now() };
}

function facilityIndex(id: string): number {
  const index = FACILITY_ORDER.indexOf(id as FacilityTier);
  return index >= 0 ? index : 0;
}

function facilityForLocation(locationId: string, rooftopTier: FacilityTier = 'tub') {
  const direct = RECOVERY_FACILITIES_BY_ID[locationId];
  if (direct) return direct;
  const hut = RECOVERY_HUTS.find((candidate) => candidate.id === locationId);
  return RECOVERY_FACILITIES_BY_ID[hut?.facility ?? rooftopTier] ?? RECOVERY_FACILITIES[0];
}

function settleRecovery(meta: MetaState, now = Date.now()): MetaState {
  const recovery = meta.recovery;
  if (!recovery.characterId || !recovery.startedAt) {
    return { ...meta, recovery: { ...recovery, lastUpdatedAt: now } };
  }
  const facility = facilityForLocation(recovery.locationId, meta.facilityTier);
  const elapsedMinutes = Math.max(0, now - recovery.lastUpdatedAt) / 60000;
  if (elapsedMinutes <= 0) return meta;
  const current = meta.fatigueByCharacter[recovery.characterId] ?? 0;
  const nextFatigue = Math.max(0, current - elapsedMinutes * facility.recoveryPctPerMinute);
  return {
    ...meta,
    fatigueByCharacter: { ...meta.fatigueByCharacter, [recovery.characterId]: nextFatigue },
    recovery: {
      ...recovery,
      lastUpdatedAt: now,
      ...(nextFatigue <= 0 ? { characterId: null, startedAt: null } : {}),
    },
  };
}

/** Keeps a persisted or dispatched tilt sensitivity inside a usable range. */
function clampGyroSensitivity(value: unknown): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 1;
  return Math.max(0.5, Math.min(2, numeric));
}

export function createInitialMeta(): MetaState {
  return {
    version: META_VERSION,
    devModeAccessUnlocked: false,
    devModeAllUnlocks: false,
    physicsObjectClicksEnabled: true,
    levelUpPausesEnabled: true,
    liveModeEnabled: false,
    lootPresentation: 'auto-pause',
    levelUpPresentation: 'pause-focus',
    pauseMapVisible: true,
    wildlifeSheltersInRain: true,
    minimapVisible: true,
    minimapExpanded: true,
    minimapPosition: { x: 0.82, y: 0.18 },
    worldInvertEnabled: false,
    paletteInvertEnabled: false,
    uiDensity: 'grid',
    musicReactiveEnabled: true,
    hideoutAmbienceEnabled: false,
    paletteAnimationsEnabled: true,
    worldPaletteBlendEnabled: true,
    gyroEnabled: false,
    studioPluginsEnabled: false,
    gyroSensitivity: 1,
    gyroInvertY: false,
    selectedCharacterId: 'shade',
    characterSkinByCharacterId: {},
    unlockedCharacterIds: CHARACTERS.filter((c) => c.unlock.kind === 'default').map((c) => c.id),
    clearedAreaIds: [],
    rescuedAllyIds: [],
    discoveryIds: [],
    lokPetCatalog: [],
    lokPetHistory: [],
    savedLokPets: [],
    selectedLokPetIds: [],
    petElixirs: 3,
    petElixirUpdatedAt: Date.now(),
    bestiary: {},
    totalKills: 0,
    totalRuns: 0,
    bestSurvivalSec: 0,
    cred: 0,
    lootTokens: 0,
    skeletonKeys: 0,
    onboarded: false,
    endlessRecordDistancePx: 0,
    endlessRecordDepth: 0,
    endlessDiscoveryIds: [],
    fatigueByCharacter: {},
    recovery: defaultRecovery(),
    facilityTier: 'tub',
    discoveredHutIds: [],
    vendorPurchases: {},
    crewActivityByAlly: {},
    crewActivitySeed: 0,
    activeCrewRumor: null,
    hideoutVisitCount: 0,
    primeTakeoverVisitsRemaining: 0,
    primeTakeoverUntil: 0,
    completedEpisodeIds: [],
    unlockedEvolutionIds: [],
    episodeProgressById: {},
    knownRelicIds: [],
    customMaps: [],
    uiPanelLayout: 'rail',
    ownedUiThemeIds: [DEFAULT_UI_THEME_ID],
    uiTheme: DEFAULT_UI_THEME_ID,
    uiThemeSwatchByTheme: {},
    ownedPaletteIds: [DEFAULT_PALETTE_ID],
    activePaletteId: DEFAULT_PALETTE_ID,
    ownedRunAuraIds: [DEFAULT_RUN_AURA_ID],
    activeRunAuraId: DEFAULT_RUN_AURA_ID,
    ownedHatIds: [DEFAULT_HAT_ID],
    activeHatId: DEFAULT_HAT_ID,
    ownedCelebrationIds: [DEFAULT_CELEBRATION_ID],
    activeCelebrationId: DEFAULT_CELEBRATION_ID,
    dailyContractDayKey: contractDayKey(),
    dailyContractProgressById: {},
    completedDailyContractIds: [],
  };
}

function idList(value: unknown, allowed: Set<string>, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry === 'string' && allowed.has(entry)) seen.add(entry);
  }
  for (const entry of fallback) seen.add(entry);
  return [...seen];
}

function normalizeEndlessDiscoveries(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const validBands = new Set<string>(ENDLESS_BANDS.map((band) => band.id));
  const discoveries = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    if (validBands.has(entry) || (entry.startsWith('beacon:') && validBands.has(entry.slice('beacon:'.length)))) {
      discoveries.add(entry);
    }
  }
  return [...discoveries];
}

function counter(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

function normalizedPosition(value: unknown, fallback: { x: number; y: number }): { x: number; y: number } {
  if (!isRecord(value)) return { ...fallback };
  const x = typeof value.x === 'number' && Number.isFinite(value.x) ? value.x : fallback.x;
  const y = typeof value.y === 'number' && Number.isFinite(value.y) ? value.y : fallback.y;
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
  };
}

function normalizeVendorPurchases(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const purchases: Record<string, number> = {};
  for (const [id, rawCount] of Object.entries(value)) {
    const item = VENDOR_CATALOG_BY_ID[id];
    if (!item) continue;
    const count = counter(rawCount);
    if (count > 0) purchases[id] = Math.min(item.maxStacks, count);
  }
  return purchases;
}

function normalizeOwnedUiThemeIds(value: unknown): string[] {
  const owned = new Set<string>([DEFAULT_UI_THEME_ID]);
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === 'string' && UI_THEMES_BY_ID[entry]) owned.add(entry);
    }
  }
  return [...owned];
}

function normalizeUiTheme(value: unknown, ownedUiThemeIds: string[]): string {
  return typeof value === 'string' && ownedUiThemeIds.includes(value) ? value : DEFAULT_UI_THEME_ID;
}

function normalizeUiThemeSwatchByTheme(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const swatches: Record<string, string> = {};
  for (const [themeId, rawSwatchId] of Object.entries(value)) {
    const theme = UI_THEMES_BY_ID[themeId];
    if (!theme?.swatches) continue;
    if (typeof rawSwatchId === 'string' && theme.swatches.some((swatch) => swatch.id === rawSwatchId)) {
      swatches[themeId] = rawSwatchId;
    }
  }
  return swatches;
}

function normalizeOwnedPaletteIds(value: unknown): string[] {
  const owned = new Set<string>([DEFAULT_PALETTE_ID]);
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === 'string' && THEMED_PALETTES_BY_ID[entry]) owned.add(entry);
    }
  }
  return [...owned];
}

function normalizePaletteId(value: unknown, ownedPaletteIds: string[]): string {
  return typeof value === 'string' && ownedPaletteIds.includes(value) ? value : DEFAULT_PALETTE_ID;
}

function normalizeOwnedRunAuraIds(value: unknown): string[] {
  return idList(value, new Set(RUN_AURAS.map((aura) => aura.id)), [DEFAULT_RUN_AURA_ID]);
}

function normalizeRunAuraId(value: unknown, ownedRunAuraIds: string[]): string {
  return typeof value === 'string' && ownedRunAuraIds.includes(value) ? value : DEFAULT_RUN_AURA_ID;
}

function normalizeOwnedIds(value: unknown, ids: string[], defaultId: string): string[] {
  return idList(value, new Set(ids), [defaultId]);
}

function normalizeOwnedCosmeticId(value: unknown, ownedIds: string[], defaultId: string): string {
  return typeof value === 'string' && ownedIds.includes(value) ? value : defaultId;
}

const LOKPET_RARITIES: LokPetRarity[] = ['common', 'charged', 'rare', 'mythic'];
const LOKPET_ATTACK_KINDS: LokPetAttackKind[] = ['shot', 'rapid-shot', 'heavy-shot', 'pulse', 'explosion'];
const LOKPET_ELEMENTS: LokPetElement[] = ['none', 'fire', 'freeze', 'slow'];
const LOKPET_ATTACK_LABELS: Record<LokPetAttackKind, string> = {
  shot: 'single shot',
  'rapid-shot': 'rapid fire',
  'heavy-shot': 'heavy shot',
  pulse: 'pulsating field',
  explosion: 'burst explosion',
};
const LOKPET_ELEMENT_LABELS: Record<LokPetElement, string> = {
  none: 'kinetic',
  fire: 'fire',
  freeze: 'freeze',
  slow: 'slow',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isOneOf<T extends string>(value: unknown, values: T[]): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function catalogTraitKey(trait: Pick<LokPetCatalogTrait, 'attackKind' | 'element'>): string {
  return `${trait.attackKind}:${trait.element}`;
}

function canonicalCatalogTrait(
  attackKind: LokPetAttackKind,
  element: LokPetElement,
): LokPetCatalogTrait {
  const elementLabel = LOKPET_ELEMENT_LABELS[element];
  const attackLabel = LOKPET_ATTACK_LABELS[attackKind];
  return {
    attackKind,
    element,
    elementLabel,
    label: element === 'none' ? attackLabel : `${attackLabel} · ${elementLabel}`,
  };
}

function sameCatalogTrait(
  left: Pick<LokPetCatalogTrait, 'attackKind' | 'element'>,
  right: Pick<LokPetCatalogTrait, 'attackKind' | 'element'>,
): boolean {
  return catalogTraitKey(left) === catalogTraitKey(right);
}

/**
 * Compare this run's generated companions with the catalog before the run.
 * Keeping this calculation separate from the write means the summary can
 * celebrate only genuinely new information while the reducer remains the
 * source of truth for persistence.
 */
export function getLokPetDiscoveries(
  existing: LokPetCatalogEntry[],
  pets: RunResult['lokPets'],
): LokPetRunDiscovery[] {
  const previousByVariant = new Map(existing.map((entry) => [entry.variantId, entry]));
  const discoveries = new Map<string, LokPetRunDiscovery>();

  for (const pet of pets) {
    const previous = previousByVariant.get(pet.variantId);
    const discovery = discoveries.get(pet.variantId) ?? {
      variantId: pet.variantId,
      sightings: 0,
      totalSightings: (previous?.sightings ?? 0),
      newVariant: !previous,
      newRarities: [],
      newTraits: [],
    };
    discovery.sightings += 1;
    discovery.totalSightings += 1;

    // Include values learned earlier in this same run only once. This keeps
    // a chest that rolls the same combination twice from making fake deltas.
    const rarityAlreadyKnown =
      previous?.rarities.includes(pet.rarity) || discovery.newRarities.includes(pet.rarity);
    if (!rarityAlreadyKnown) discovery.newRarities.push(pet.rarity);

    const trait = canonicalCatalogTrait(pet.attackKind, pet.element);
    const traitAlreadyKnown =
      previous?.traits.some((candidate) => sameCatalogTrait(candidate, trait)) ||
      discovery.newTraits.some((candidate) => sameCatalogTrait(candidate, trait));
    if (!traitAlreadyKnown) discovery.newTraits.push(trait);

    discoveries.set(pet.variantId, discovery);
  }

  return [...discoveries.values()];
}

/**
 * Normalize catalog records independently from the rest of the save. The
 * variant sheet is the source of truth for presentation fields, so malformed
 * localStorage cannot inject a different palette or identity into the archive.
 */
export function normalizeLokPetCatalog(value: unknown): LokPetCatalogEntry[] {
  if (!Array.isArray(value)) return [];

  const entries = new Map<string, LokPetCatalogEntry>();
  for (const rawValue of value) {
    if (!isRecord(rawValue) || typeof rawValue.variantId !== 'string') continue;
    const variant = LOKPET_VARIANTS_BY_ID[rawValue.variantId];
    if (!variant) continue;

    const rarities = Array.isArray(rawValue.rarities)
      ? rawValue.rarities.filter((rarity): rarity is LokPetRarity => isOneOf(rarity, LOKPET_RARITIES))
      : [];
    const traits: LokPetCatalogTrait[] = [];
    if (Array.isArray(rawValue.traits)) {
      for (const traitValue of rawValue.traits) {
        if (!isRecord(traitValue)) continue;
        if (!isOneOf(traitValue.attackKind, LOKPET_ATTACK_KINDS)) continue;
        if (!isOneOf(traitValue.element, LOKPET_ELEMENTS)) continue;
        const trait = canonicalCatalogTrait(traitValue.attackKind, traitValue.element);
        if (!traits.some((candidate) => catalogTraitKey(candidate) === catalogTraitKey(trait))) {
          traits.push(trait);
        }
      }
    }

    const current = entries.get(variant.id);
    if (current) {
      current.rarities = [...new Set([...current.rarities, ...rarities])];
      for (const trait of traits) {
        if (!current.traits.some((candidate) => catalogTraitKey(candidate) === catalogTraitKey(trait))) {
          current.traits.push(trait);
        }
      }
      current.sightings += counter(rawValue.sightings);
      continue;
    }

    entries.set(variant.id, {
      variantId: variant.id,
      family: variant.family,
      silhouette: variant.silhouette,
      palette: variant.palette,
      rarities: [...new Set(rarities)],
      traits,
      sightings: counter(rawValue.sightings),
    });
  }

  return [...entries.values()];
}

function recordLokPetCatalog(existing: LokPetCatalogEntry[], pets: RunResult['lokPets']): LokPetCatalogEntry[] {
  const entries = new Map(
    existing.map((entry) => [
      entry.variantId,
      {
        ...entry,
        rarities: [...entry.rarities],
        traits: entry.traits.map((trait) => ({ ...trait })),
      },
    ]),
  );

  for (const pet of pets) {
    const variant = LOKPET_VARIANTS_BY_ID[pet.variantId];
    if (!variant) continue;
    const entry = entries.get(variant.id) ?? {
      variantId: variant.id,
      family: variant.family,
      silhouette: variant.silhouette,
      palette: variant.palette,
      rarities: [],
      traits: [],
      sightings: 0,
    };
    entry.sightings += 1;
    if (!entry.rarities.includes(pet.rarity)) entry.rarities.push(pet.rarity);
    const trait = canonicalCatalogTrait(pet.attackKind, pet.element);
    if (!entry.traits.some((candidate) => catalogTraitKey(candidate) === catalogTraitKey(trait))) {
      entry.traits.push(trait);
    }
    entries.set(variant.id, entry);
  }

  return [...entries.values()];
}

function normalizeLokPetHistory(value: unknown): LokPetDiscoveryHistoryEntry[] {
  if (!Array.isArray(value)) return [];

  const history: LokPetDiscoveryHistoryEntry[] = [];
  for (const rawValue of value) {
    if (!isRecord(rawValue)) continue;
    const rawDiscoveries = rawValue.discoveries;
    if (!Array.isArray(rawDiscoveries)) continue;

    const discoveries: LokPetRunDiscovery[] = [];
    for (const rawDiscovery of rawDiscoveries) {
      if (!isRecord(rawDiscovery) || typeof rawDiscovery.variantId !== 'string') continue;
      if (!LOKPET_VARIANTS_BY_ID[rawDiscovery.variantId]) continue;

      const newRarities = Array.isArray(rawDiscovery.newRarities)
        ? [...new Set(rawDiscovery.newRarities.filter((rarity): rarity is LokPetRarity => isOneOf(rarity, LOKPET_RARITIES)))]
        : [];
      const newTraits: LokPetCatalogTrait[] = [];
      if (Array.isArray(rawDiscovery.newTraits)) {
        for (const rawTrait of rawDiscovery.newTraits) {
          if (!isRecord(rawTrait)) continue;
          if (!isOneOf(rawTrait.attackKind, LOKPET_ATTACK_KINDS)) continue;
          if (!isOneOf(rawTrait.element, LOKPET_ELEMENTS)) continue;
          const trait = canonicalCatalogTrait(rawTrait.attackKind, rawTrait.element);
          if (!newTraits.some((candidate) => catalogTraitKey(candidate) === catalogTraitKey(trait))) {
            newTraits.push(trait);
          }
        }
      }

      discoveries.push({
        variantId: rawDiscovery.variantId,
        sightings: counter(rawDiscovery.sightings),
        totalSightings: counter(rawDiscovery.totalSightings),
        newVariant: rawDiscovery.newVariant === true,
        newRarities,
        newTraits,
      });
    }

    if (discoveries.length === 0) continue;
    history.push({
      runNumber: counter(rawValue.runNumber),
      recordedAt:
        typeof rawValue.recordedAt === 'number' && Number.isFinite(rawValue.recordedAt)
          ? rawValue.recordedAt
          : 0,
      areaId: typeof rawValue.areaId === 'string' ? rawValue.areaId : 'unknown',
      characterId: typeof rawValue.characterId === 'string' ? rawValue.characterId : 'unknown',
      cleared: rawValue.cleared === true,
      discoveries,
    });
  }

  return history
    .sort((left, right) => right.recordedAt - left.recordedAt || right.runNumber - left.runNumber)
    .slice(0, 100);
}

const PET_STAMINA_MAX = 3;
const ELIXIR_GRANT_MS = 20 * 60 * 1000;
const ELIXIR_GRANT_AMOUNT = 3;
const ELIXIR_CAP = 18;

function normalizeSavedLokPets(value: unknown): SavedLokPet[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object') return [];
    const candidate = entry as Partial<SavedLokPet>;
    const roll = candidate.roll;
    if (!roll || typeof roll !== 'object' || typeof candidate.id !== 'string' || typeof roll.variantId !== 'string' || typeof roll.name !== 'string') return [];
    return [{ id: candidate.id, roll: roll as SavedLokPet['roll'], stamina: Math.max(0, Math.min(PET_STAMINA_MAX, counter(candidate.stamina))) }];
  }).slice(0, 48);
}

function replenishPetElixirs(meta: MetaState, now = Date.now()): Pick<MetaState, 'petElixirs' | 'petElixirUpdatedAt'> {
  const elapsed = Math.max(0, now - meta.petElixirUpdatedAt);
  const grants = Math.floor(elapsed / ELIXIR_GRANT_MS);
  return grants > 0
    ? { petElixirs: Math.min(ELIXIR_CAP, meta.petElixirs + grants * ELIXIR_GRANT_AMOUNT), petElixirUpdatedAt: meta.petElixirUpdatedAt + grants * ELIXIR_GRANT_MS }
    : { petElixirs: meta.petElixirs, petElixirUpdatedAt: meta.petElixirUpdatedAt };
}

/** Coerce an untrusted save payload into a usable MetaState. */
export function normalizeMeta(parsed: Partial<MetaState>): MetaState {
  const defaults = createInitialMeta();
  const liveModeEnabled = parsed.liveModeEnabled === true;
  const characterIds = new Set(CHARACTERS.map((c) => c.id));
  const areaIds = new Set(AREAS.map((a) => a.id));
  const allyIds = new Set(ALLIES.map((a) => a.id));
  const discoveryIds = new Set(DISCOVERIES.map((d) => d.id));
  const enemyIds = new Set(ENEMIES.map((e) => e.id));
  const episodeIds = new Set(CHARACTER_EPISODES.map((episode) => episode.id));
  const evolutionIds = new Set(Object.keys(EVOLUTIONS_BY_ID));
  const fatigueByCharacter: Record<string, number> = {};
  if (parsed.fatigueByCharacter && typeof parsed.fatigueByCharacter === 'object') {
    for (const [key, value] of Object.entries(parsed.fatigueByCharacter)) {
      if (characterIds.has(key) && typeof value === 'number' && Number.isFinite(value)) {
        fatigueByCharacter[key] = Math.min(MAX_FATIGUE_PCT, Math.max(0, value));
      }
    }
  }
  const parsedRecovery = parsed.recovery;
  const recovery: RecoverySession = {
    characterId:
      parsedRecovery && typeof parsedRecovery.characterId === 'string' && characterIds.has(parsedRecovery.characterId)
        ? parsedRecovery.characterId
        : null,
    locationId:
      parsedRecovery && typeof parsedRecovery.locationId === 'string' &&
      (RECOVERY_FACILITIES_BY_ID[parsedRecovery.locationId] || RECOVERY_HUTS.some((hut) => hut.id === parsedRecovery.locationId))
        ? parsedRecovery.locationId
        : 'rooftop',
    startedAt:
      parsedRecovery && typeof parsedRecovery.startedAt === 'number' && Number.isFinite(parsedRecovery.startedAt)
        ? parsedRecovery.startedAt
        : null,
    lastUpdatedAt:
      parsedRecovery && typeof parsedRecovery.lastUpdatedAt === 'number' && Number.isFinite(parsedRecovery.lastUpdatedAt)
        ? parsedRecovery.lastUpdatedAt
        : Date.now(),
  };
  const discoveredHutIds = idList(parsed.discoveredHutIds, new Set(RECOVERY_HUTS.map((hut) => hut.id)), []);
  const tier =
    typeof parsed.facilityTier === 'string' && RECOVERY_FACILITIES_BY_ID[parsed.facilityTier]
      ? parsed.facilityTier as FacilityTier
      : 'tub';
  const crewActivitySeed =
    typeof parsed.crewActivitySeed === 'number' && Number.isFinite(parsed.crewActivitySeed)
      ? Math.max(0, Math.floor(parsed.crewActivitySeed))
      : 0;

  const bestiary: Record<string, number> = {};
  if (parsed.bestiary && typeof parsed.bestiary === 'object') {
    for (const [key, value] of Object.entries(parsed.bestiary)) {
      if (enemyIds.has(key)) bestiary[key] = counter(value);
    }
  }

  const unlockedCharacterIds = idList(
    parsed.unlockedCharacterIds,
    characterIds,
    defaults.unlockedCharacterIds,
  );
  const selectedCharacterId =
    typeof parsed.selectedCharacterId === 'string' &&
    unlockedCharacterIds.includes(parsed.selectedCharacterId)
      ? parsed.selectedCharacterId
      : (unlockedCharacterIds[0] ?? defaults.selectedCharacterId);
  const rescuedAllyIds = idList(parsed.rescuedAllyIds, allyIds, []);
  const crewActivityByAlly = normalizeCrewActivities(
    parsed.crewActivityByAlly,
    rescuedAllyIds,
    crewActivitySeed,
  );
  const completedEpisodeIds = idList(parsed.completedEpisodeIds, episodeIds, []);
  const characterSkinByCharacterId: Record<string, string> = {};
  if (parsed.characterSkinByCharacterId && typeof parsed.characterSkinByCharacterId === 'object') {
    for (const character of CHARACTERS) {
      const requested = parsed.characterSkinByCharacterId[character.id];
      const skin = getCharacterSkins(character).find((entry) => entry.id === requested);
      const characterEpisode = CHARACTER_EPISODES.find((entry) => entry.characterId === character.id);
      if (skin && (!skin.episodeRequired || Boolean(characterEpisode && completedEpisodeIds.includes(characterEpisode.id)))) {
        characterSkinByCharacterId[character.id] = skin.id;
      }
    }
  }
  const episodeProgressById: Record<string, number> = {};
  if (parsed.episodeProgressById && typeof parsed.episodeProgressById === 'object') {
    for (const [episodeId, value] of Object.entries(parsed.episodeProgressById)) {
      const definition = CHARACTER_EPISODES_BY_ID[episodeId];
      if (!definition || typeof value !== 'number' || !Number.isFinite(value)) continue;
      episodeProgressById[episodeId] = Math.min(
        definition.objective.targetCount,
        Math.max(0, Math.floor(value)),
      );
    }
  }
  const knownRelicIds = idList(
    parsed.knownRelicIds,
    new Set(CITY_RELICS.map((relic) => relic.id)),
    [],
  );
  const endlessDiscoveryIds = normalizeEndlessDiscoveries(parsed.endlessDiscoveryIds);
  const customMaps = normalizeCustomMaps(parsed.customMaps);
  const ownedUiThemeIds = normalizeOwnedUiThemeIds(parsed.ownedUiThemeIds);
  const ownedRunAuraIds = normalizeOwnedRunAuraIds(parsed.ownedRunAuraIds);
  const ownedHatIds = normalizeOwnedIds(parsed.ownedHatIds, HATS.map((hat) => hat.id), DEFAULT_HAT_ID);
  const ownedCelebrationIds = normalizeOwnedIds(parsed.ownedCelebrationIds, CELEBRATIONS.map((entry) => entry.id), DEFAULT_CELEBRATION_ID);
  const today = contractDayKey();
  const savedContractDay = typeof parsed.dailyContractDayKey === 'string' ? parsed.dailyContractDayKey : today;
  const dailyContractDayKey = savedContractDay === today ? savedContractDay : today;
  const validContractIds = new Set(dailyContractDefs(dailyContractDayKey).map((contract) => contract.id));
  const dailyContractProgressById: Record<string, number> = {};
  if (dailyContractDayKey === savedContractDay && parsed.dailyContractProgressById && typeof parsed.dailyContractProgressById === 'object') {
    for (const [id, value] of Object.entries(parsed.dailyContractProgressById)) {
      if (validContractIds.has(id) && typeof value === 'number' && Number.isFinite(value)) {
        dailyContractProgressById[id] = Math.max(0, Math.floor(value));
      }
    }
  }
  const completedDailyContractIds = dailyContractDayKey === savedContractDay && Array.isArray(parsed.completedDailyContractIds)
    ? parsed.completedDailyContractIds.filter((id): id is string => typeof id === 'string' && validContractIds.has(id))
    : [];
  const explicitEvolutionIds = idList(parsed.unlockedEvolutionIds, evolutionIds, []).filter((evolutionId) => {
    const evolution = EVOLUTIONS_BY_ID[evolutionId];
    return Boolean(evolution?.episodeId && completedEpisodeIds.includes(evolution.episodeId));
  });
  const completedEvolutionIds = completedEpisodeIds
    .map((episodeId) => CHARACTER_EPISODES_BY_ID[episodeId]?.evolutionId)
    .filter((evolutionId): evolutionId is string => Boolean(evolutionId));
  const unlockedEvolutionIds = [...new Set([...explicitEvolutionIds, ...completedEvolutionIds])];
  const savedLokPets = normalizeSavedLokPets(parsed.savedLokPets);
  const recoveredElixirs = replenishPetElixirs({
    ...defaults,
    petElixirs: Math.min(ELIXIR_CAP, counter(parsed.petElixirs ?? 3)),
    petElixirUpdatedAt: Math.max(0, typeof parsed.petElixirUpdatedAt === 'number' ? parsed.petElixirUpdatedAt : Date.now()),
  });

  return {
    version: META_VERSION,
    devModeAccessUnlocked: parsed.devModeAccessUnlocked === true,
    devModeAllUnlocks: parsed.devModeAccessUnlocked === true && parsed.devModeAllUnlocks === true,
    physicsObjectClicksEnabled: parsed.physicsObjectClicksEnabled !== false,
    levelUpPausesEnabled: !liveModeEnabled && parsed.levelUpPausesEnabled !== false,
    liveModeEnabled,
    lootPresentation: liveModeEnabled || parsed.lootPresentation === 'queue' ? 'queue' : 'auto-pause',
    levelUpPresentation:
      parsed.levelUpPresentation === 'random-live' || parsed.levelUpPresentation === 'compact-live'
        ? parsed.levelUpPresentation
        : liveModeEnabled || parsed.levelUpPausesEnabled === false ? 'compact-live' : 'pause-focus',
    pauseMapVisible: parsed.pauseMapVisible !== false,
    wildlifeSheltersInRain: parsed.wildlifeSheltersInRain !== false,
    minimapVisible: parsed.minimapVisible !== false,
    minimapExpanded: parsed.minimapExpanded !== false,
    minimapPosition: normalizedPosition(parsed.minimapPosition, defaults.minimapPosition),
    worldInvertEnabled: parsed.worldInvertEnabled === true,
    paletteInvertEnabled: parsed.paletteInvertEnabled === true,
    uiDensity: parsed.uiDensity === 'list' ? 'list' : 'grid',
    musicReactiveEnabled: parsed.musicReactiveEnabled !== false,
    // Opt-in, unlike the other audio toggles: ambience should never start
    // making noise on its own for a returning save that predates it.
    hideoutAmbienceEnabled: parsed.hideoutAmbienceEnabled === true,
    paletteAnimationsEnabled: parsed.paletteAnimationsEnabled !== false,
    worldPaletteBlendEnabled: parsed.worldPaletteBlendEnabled !== false,
    gyroEnabled: parsed.gyroEnabled === true,
    // Defaults to false on every load, including projects saved before this
    // existed -- remote code is never enabled by an upgrade.
    studioPluginsEnabled: parsed.studioPluginsEnabled === true,
    gyroSensitivity: clampGyroSensitivity(parsed.gyroSensitivity),
    gyroInvertY: parsed.gyroInvertY === true,
    selectedCharacterId,
    characterSkinByCharacterId,
    unlockedCharacterIds,
    clearedAreaIds: idList(parsed.clearedAreaIds, areaIds, []),
    rescuedAllyIds,
    discoveryIds: idList(parsed.discoveryIds, discoveryIds, []),
    lokPetCatalog: normalizeLokPetCatalog(parsed.lokPetCatalog),
    lokPetHistory: normalizeLokPetHistory(parsed.lokPetHistory),
    savedLokPets,
    selectedLokPetIds: savedLokPets.filter((pet) => pet.stamina > 0 && Array.isArray(parsed.selectedLokPetIds) && parsed.selectedLokPetIds.includes(pet.id)).map((pet) => pet.id).slice(0, 3),
    ...recoveredElixirs,
    bestiary,
    totalKills: counter(parsed.totalKills),
    totalRuns: counter(parsed.totalRuns),
    bestSurvivalSec: counter(parsed.bestSurvivalSec),
    cred: counter(parsed.cred),
    lootTokens: counter(parsed.lootTokens),
    skeletonKeys: counter(parsed.skeletonKeys),
    onboarded: parsed.onboarded === true,
    endlessRecordDistancePx: counter(parsed.endlessRecordDistancePx),
    endlessRecordDepth: counter(parsed.endlessRecordDepth),
    endlessDiscoveryIds,
    fatigueByCharacter,
    recovery,
    facilityTier: tier,
    discoveredHutIds,
    vendorPurchases: normalizeVendorPurchases(parsed.vendorPurchases),
    crewActivityByAlly,
    crewActivitySeed,
    activeCrewRumor: normalizeActiveCrewRumor(
      parsed.activeCrewRumor,
      rescuedAllyIds,
      crewActivityByAlly,
      crewActivitySeed,
    ),
    hideoutVisitCount: counter(parsed.hideoutVisitCount),
    primeTakeoverVisitsRemaining: counter(parsed.primeTakeoverVisitsRemaining),
    primeTakeoverUntil: counter(parsed.primeTakeoverUntil),
    completedEpisodeIds,
    unlockedEvolutionIds,
    episodeProgressById,
    knownRelicIds,
    customMaps,
    uiPanelLayout: parsed.uiPanelLayout === 'slideout' ? 'slideout' : 'rail',
    ownedUiThemeIds,
    uiTheme: normalizeUiTheme(parsed.uiTheme, ownedUiThemeIds),
    uiThemeSwatchByTheme: normalizeUiThemeSwatchByTheme(parsed.uiThemeSwatchByTheme),
    ownedPaletteIds: normalizeOwnedPaletteIds(parsed.ownedPaletteIds),
    activePaletteId: normalizePaletteId(parsed.activePaletteId, normalizeOwnedPaletteIds(parsed.ownedPaletteIds)),
    ownedRunAuraIds,
    activeRunAuraId: normalizeRunAuraId(parsed.activeRunAuraId, ownedRunAuraIds),
    ownedHatIds,
    activeHatId: normalizeOwnedCosmeticId(parsed.activeHatId, ownedHatIds, DEFAULT_HAT_ID),
    ownedCelebrationIds,
    activeCelebrationId: normalizeOwnedCosmeticId(parsed.activeCelebrationId, ownedCelebrationIds, DEFAULT_CELEBRATION_ID),
    dailyContractDayKey,
    dailyContractProgressById,
    completedDailyContractIds: [...new Set(completedDailyContractIds)],
  };
}

export function loadMeta(): MetaState {
  if (typeof window === 'undefined') return createInitialMeta();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialMeta();
    const parsed = JSON.parse(raw) as Partial<MetaState>;
    if (parsed === null || typeof parsed !== 'object') return createInitialMeta();
    if (parsed.version !== META_VERSION && parsed.version !== 14 && parsed.version !== 13 && parsed.version !== 12 && parsed.version !== 11 && parsed.version !== 10 && parsed.version !== 9 && parsed.version !== 8 && parsed.version !== 7 && parsed.version !== 6 && parsed.version !== 5 && parsed.version !== 4 && parsed.version !== 3 && parsed.version !== 2 && parsed.version !== 1) return createInitialMeta();
    // Hand-edited or half-written saves must never brick the game, so every
    // field is normalised against the defaults rather than merged blindly.
    return normalizeMeta(parsed);
  } catch (error) {
    console.warn('Could not read saved progress, starting fresh.', error);
    return createInitialMeta();
  }
}

function saveMeta(meta: MetaState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  } catch (error) {
    // A full or blocked storage quota must not break the game.
    console.warn('Could not save progress.', error);
  }
}

/* ------------------------------------------------------------------ */
/* Unlock evaluation                                                   */
/* ------------------------------------------------------------------ */

export function isUnlocked(rule: UnlockRule, meta: MetaState): boolean {
  if (meta.devModeAllUnlocks) return true;

  switch (rule.kind) {
    case 'default':
      return true;
    case 'rescue':
      return meta.rescuedAllyIds.includes(rule.allyId);
    case 'clearArea':
      return meta.clearedAreaIds.includes(rule.areaId);
    case 'discovery':
      return meta.discoveryIds.includes(rule.discoveryId);
    case 'kills':
      return meta.totalKills >= rule.count;
    default:
      return false;
  }
}

export function describeUnlock(rule: UnlockRule): string {
  switch (rule.kind) {
    case 'default':
      return 'Available from the start';
    case 'rescue':
      return `Rescue ${ALLIES_BY_ID[rule.allyId]?.name ?? rule.allyId}`;
    case 'clearArea':
      return `Clear ${AREAS.find((a) => a.id === rule.areaId)?.name ?? rule.areaId}`;
    case 'discovery':
      return 'Find a hidden location';
    case 'kills':
      return `Defeat ${rule.count} enemies`;
    default:
      return 'Locked';
  }
}

export type EpisodeStatus = 'locked' | 'available' | 'in-progress' | 'completed';

export function episodeStatus(episodeId: string, meta: MetaState): EpisodeStatus {
  const episode = CHARACTER_EPISODES_BY_ID[episodeId];
  if (!episode) return 'locked';
  if (meta.completedEpisodeIds.includes(episode.id)) return 'completed';
  const characterUnlocked = meta.unlockedCharacterIds.includes(episode.characterId) || meta.devModeAllUnlocks;
  if (!characterUnlocked || !isUnlocked(episode.unlock, meta)) return 'locked';
  return (meta.episodeProgressById[episode.id] ?? 0) > 0 ? 'in-progress' : 'available';
}

export function episodeProgress(episodeId: string, meta: MetaState): number {
  const episode = CHARACTER_EPISODES_BY_ID[episodeId];
  if (!episode) return 0;
  return Math.min(episode.objective.targetCount, Math.max(0, Math.floor(meta.episodeProgressById[episode.id] ?? 0)));
}

function validEpisodeResult(result: RunResult): CharacterEpisodeDef | undefined {
  const record = result.episode;
  if (!record) return undefined;
  const definition = CHARACTER_EPISODES_BY_ID[record.id];
  if (!definition || definition.characterId !== result.characterId || definition.areaId !== result.areaId) return undefined;
  if (record.target !== definition.objective.targetCount || record.objectiveLabel !== definition.objective.label) return undefined;
  return definition;
}

/** Total permanent stat boost granted by every rescued ally. */
export function allyBoostTotals(meta: MetaState): Partial<BaseStats> {
  const totals: Partial<BaseStats> = {};
  for (const id of meta.rescuedAllyIds) {
    const ally = ALLIES_BY_ID[id];
    if (!ally) continue;
    for (const [key, value] of Object.entries(ally.boost) as Array<[keyof BaseStats, number]>) {
      totals[key] = (totals[key] ?? 0) + value;
    }
  }
  return totals;
}

/** A character's stats after permanent ally boosts are applied. */
export function effectiveStats(character: CharacterDef, meta: MetaState): BaseStats {
  const settled = settleRecovery(meta);
  const boosts = allyBoostTotals(meta);
  const stats: BaseStats = { ...character.stats };
  for (const [key, value] of Object.entries(boosts) as Array<[keyof BaseStats, number]>) {
    stats[key] = stats[key] + value;
  }
  for (const effect of crewActivityEffects(meta)) {
    if (effect.add) stats[effect.stat] += effect.add;
    if (effect.mult) stats[effect.stat] *= effect.mult;
  }
  for (const item of VENDOR_CATALOG) {
    const stacks = Math.min(item.maxStacks, Math.max(0, Math.floor(meta.vendorPurchases[item.id] ?? 0)));
    if (!stacks) continue;
    for (const effect of item.effects ?? []) {
      if (effect.kind !== 'stat') continue;
      if (effect.add) stats[effect.stat] += effect.add * stacks;
      if (effect.mult) stats[effect.stat] *= Math.pow(effect.mult, stacks);
      if (effect.cap !== undefined) stats[effect.stat] = Math.min(stats[effect.stat], effect.cap);
    }
  }
  stats.armor = Math.min(stats.armor, 0.6);
  const fatigue = Math.min(MAX_FATIGUE_PCT, Math.max(0, settled.fatigueByCharacter[character.id] ?? 0)) / 100;
  stats.maxHp *= 1 - fatigue;
  stats.speed *= 1 - fatigue;
  stats.power *= 1 - fatigue;
  stats.area *= 1 - fatigue;
  stats.magnet *= 1 - fatigue;
  stats.armor = Math.max(0, stats.armor * (1 - fatigue));
  stats.haste *= 1 + fatigue;
  return stats;
}

/** Permanent utility bonuses used when constructing a new run. */
export function startingWeaponLevel(meta: MetaState): number {
  const levelBoost = VENDOR_CATALOG.reduce((total, item) => {
    const stacks = Math.min(item.maxStacks, Math.max(0, Math.floor(meta.vendorPurchases[item.id] ?? 0)));
    return total + (item.effects ?? []).reduce(
      (sum, effect) => sum + (effect.kind === 'utility' && effect.utility === 'starting-weapon-level' ? effect.amount * stacks : 0),
      0,
    );
  }, 0);
  return Math.min(8, 1 + levelBoost);
}

/** Permanent utility bonuses applied to the final cred payout. */
export function rewardCredMultiplier(meta: MetaState): number {
  const bonus = VENDOR_CATALOG.reduce((total, item) => {
    const stacks = Math.min(item.maxStacks, Math.max(0, Math.floor(meta.vendorPurchases[item.id] ?? 0)));
    return total + (item.effects ?? []).reduce(
      (sum, effect) => sum + (effect.kind === 'utility' && effect.utility === 'reward-cred-mult' ? effect.amount * stacks : 0),
      0,
    );
  }, 0);
  return 1 + bonus;
}

/** Extra world units the "prime a movable prop" tap/click radius reaches, from Grabby Hands stacks. */
export function physicsObjectClickRadiusBonus(meta: MetaState): number {
  return vendorPurchaseCount(meta, 'grabby-hands') * 18;
}

/** 2 once Colossus Frame is owned (player renders and collides twice as large), else 1. */
export function giantSizeMult(meta: MetaState): number {
  return vendorPurchaseCount(meta, 'colossus-frame') > 0 ? 2 : 1;
}

/** Ghost Cloak + its upgrade tree, resolved into the numbers stepWorld needs. Null when not owned. */
export function stealthConfig(meta: MetaState): StealthAbilityConfig | null {
  if (vendorPurchaseCount(meta, 'ghost-cloak') <= 0) return null;
  const durationStacks = vendorPurchaseCount(meta, 'ghost-cloak-duration');
  const rateStacks = vendorPurchaseCount(meta, 'ghost-cloak-rate');
  const fullInvisible = vendorPurchaseCount(meta, 'ghost-cloak-full') > 0;
  return {
    durationMs: 2500 + durationStacks * 1200 + (fullInvisible ? 1500 : 0),
    cooldownMs: Math.max(4000, 14000 - rateStacks * 3000 - (fullInvisible ? 2000 : 0)),
    fullInvisible,
    damageBonusPct: fullInvisible ? 0.05 : 0,
  };
}

/** Whether "Let Me Hold This" is owned: any hazard weapon stops hurting whoever's holding it, native character or not. */
export function hazardImmunityUnlocked(meta: MetaState): boolean {
  return vendorPurchaseCount(meta, 'hazard-handler') > 0;
}

/** True while Artisan Valor Prime is fronting the Paint Gallery and re-theming the hideout (every 14th hideout visit, for a few visits or occasionally a real 24h window). */
export function isPrimeTakeoverActive(meta: MetaState, now: number): boolean {
  return meta.primeTakeoverVisitsRemaining > 0 || now < meta.primeTakeoverUntil;
}

/** True on the single hideout visit where Prime briefly flickers into the Paint Gallery as a tease (every 4th visit that isn't also a full 14th-visit takeover). */
export function isPrimeFlickerVisit(meta: MetaState): boolean {
  return meta.hideoutVisitCount % 4 === 0 && meta.hideoutVisitCount % 14 !== 0;
}

/** Which minimap recon tiers are unlocked, in purchase order. */
export function minimapUnlockTiers(meta: MetaState): {
  enemyRadar: boolean;
  lootSense: boolean;
  hazardSense: boolean;
} {
  return {
    enemyRadar: vendorPurchaseCount(meta, 'minimap-street-ears') > 0,
    lootSense: vendorPurchaseCount(meta, 'minimap-loot-sense') > 0,
    hazardSense: vendorPurchaseCount(meta, 'minimap-hazard-sense') > 0,
  };
}

export function currentFatiguePct(meta: MetaState, characterId: string): number {
  return Math.min(MAX_FATIGUE_PCT, Math.max(0, settleRecovery(meta).fatigueByCharacter[characterId] ?? 0));
}

export function recoveryRemainingMs(meta: MetaState): number {
  const settled = settleRecovery(meta);
  if (!settled.recovery.characterId) return 0;
  const facility = facilityForLocation(settled.recovery.locationId, settled.facilityTier);
  const fatigue = currentFatiguePct(settled, settled.recovery.characterId);
  return (fatigue / facility.recoveryPctPerMinute) * 60000;
}

/* ------------------------------------------------------------------ */
/* Reducer                                                             */
/* ------------------------------------------------------------------ */

interface StoreState {
  meta: MetaState;
  /** Result of the most recent run; not persisted. */
  lastRun: RunResult | null;
}

type Action =
  | { type: 'selectCharacter'; id: string }
  | { type: 'selectCharacterSkin'; characterId: string; skinId: string }
  | { type: 'enterHideout'; now: number }
  | { type: 'completeRun'; result: RunResult }
  | { type: 'toggleSavedLokPet'; id: string }
  | { type: 'restoreSavedLokPet'; id: string; now: number }
  | { type: 'refreshPetElixirs'; now: number }
  | { type: 'clearLastRun' }
  | { type: 'markOnboarded' }
  | { type: 'spendTokens'; amount: number }
  | { type: 'buyVendorItem'; id: string }
  | { type: 'refundVendorItem'; id: string }
  | { type: 'refundAllVendorItems' }
  | { type: 'setUiPanelLayout'; layout: UIPanelLayout }
  | { type: 'buyUiTheme'; id: string }
  | { type: 'equipUiTheme'; id: string }
  | { type: 'selectUiThemeSwatch'; themeId: string; swatchId: string }
  | { type: 'buyPalette'; id: string }
  | { type: 'equipPalette'; id: string }
  | { type: 'buyRunAura'; id: string }
  | { type: 'equipRunAura'; id: string }
  | { type: 'buyHat'; id: string }
  | { type: 'equipHat'; id: string }
  | { type: 'buyCelebration'; id: string }
  | { type: 'equipCelebration'; id: string }
  | { type: 'cycleUiLook' }
  | { type: 'unlockDevModeAccess' }
  | { type: 'setDevModeAllUnlocks'; enabled: boolean }
  | { type: 'setPhysicsObjectClicks'; enabled: boolean }
  | { type: 'setLevelUpPauses'; enabled: boolean }
  | { type: 'setLiveMode'; enabled: boolean }
  | { type: 'setLootPresentation'; value: MetaState['lootPresentation'] }
  | { type: 'setLevelUpPresentation'; value: MetaState['levelUpPresentation'] }
  | { type: 'setPauseMapVisible'; enabled: boolean }
  | { type: 'setWildlifeSheltersInRain'; enabled: boolean }
  | { type: 'setMinimapVisible'; enabled: boolean }
  | { type: 'setMusicReactive'; enabled: boolean }
  | { type: 'setHideoutAmbience'; enabled: boolean }
  | { type: 'setPaletteAnimations'; enabled: boolean }
  | { type: 'setWorldPaletteBlend'; enabled: boolean }
  | { type: 'setGyroEnabled'; enabled: boolean }
  | { type: 'setStudioPlugins'; enabled: boolean }
  | { type: 'setGyroSensitivity'; value: number }
  | { type: 'setGyroInvertY'; enabled: boolean }
  | { type: 'setMinimapExpanded'; enabled: boolean }
  | { type: 'setMinimapPosition'; position: { x: number; y: number } }
  | { type: 'setWorldInvertEnabled'; enabled: boolean }
  | { type: 'setPaletteInvertEnabled'; enabled: boolean }
  | { type: 'setUiDensity'; density: 'grid' | 'list' }
  | { type: 'startRecovery'; characterId: string; locationId?: string }
  | { type: 'stopRecovery' }
  | { type: 'tickRecovery'; now: number }
  | { type: 'upgradeFacility' }
  | { type: 'createCustomMap' }
  | { type: 'saveCustomMap'; map: CustomMap }
  | { type: 'duplicateCustomMap'; id: string }
  | { type: 'deleteCustomMap'; id: string }
  | { type: 'reset' };

function addUnique(list: string[], value?: string): string[] {
  if (!value || list.includes(value)) return list;
  return [...list, value];
}

export function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case 'selectCharacter':
      return { ...state, meta: { ...state.meta, selectedCharacterId: action.id } };

    case 'selectCharacterSkin': {
      const character = CHARACTERS.find((entry) => entry.id === action.characterId);
      if (!character) return state;
      const skin = getCharacterSkins(character).find((entry) => entry.id === action.skinId);
      const characterEpisode = CHARACTER_EPISODES.find((entry) => entry.characterId === character.id);
      if (!skin || (skin.episodeRequired && (!characterEpisode || !state.meta.completedEpisodeIds.includes(characterEpisode.id)))) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          characterSkinByCharacterId: { ...state.meta.characterSkinByCharacterId, [character.id]: skin.id },
        },
      };
    }

    case 'toggleSavedLokPet': {
      const pet = state.meta.savedLokPets.find((candidate) => candidate.id === action.id);
      if (!pet || pet.stamina <= 0) return state;
      const selected = state.meta.selectedLokPetIds.includes(action.id)
        ? state.meta.selectedLokPetIds.filter((id) => id !== action.id)
        : state.meta.selectedLokPetIds.length < 3 ? [...state.meta.selectedLokPetIds, action.id] : state.meta.selectedLokPetIds;
      return { ...state, meta: { ...state.meta, selectedLokPetIds: selected } };
    }

    case 'restoreSavedLokPet': {
      const recovery = replenishPetElixirs(state.meta, action.now);
      const pet = state.meta.savedLokPets.find((candidate) => candidate.id === action.id);
      if (!pet || pet.stamina >= PET_STAMINA_MAX || recovery.petElixirs < 1) return { ...state, meta: { ...state.meta, ...recovery } };
      return { ...state, meta: { ...state.meta, ...recovery, petElixirs: recovery.petElixirs - 1, savedLokPets: state.meta.savedLokPets.map((candidate) => candidate.id === action.id ? { ...candidate, stamina: candidate.stamina + 1 } : candidate) } };
    }

    case 'refreshPetElixirs': {
      const recovery = replenishPetElixirs(state.meta, action.now);
      return recovery.petElixirs === state.meta.petElixirs
        ? state
        : { ...state, meta: { ...state.meta, ...recovery } };
    }

    case 'enterHideout': {
      const crewActivitySeed = state.meta.crewActivitySeed + 1;
      const crewActivityByAlly = rollCrewActivities(state.meta.rescuedAllyIds, crewActivitySeed);
      const hideoutVisitCount = state.meta.hideoutVisitCount + 1;
      let primeTakeoverVisitsRemaining = Math.max(0, state.meta.primeTakeoverVisitsRemaining - 1);
      let primeTakeoverUntil = state.meta.primeTakeoverUntil;
      if (hideoutVisitCount % 14 === 0) {
        if (Math.random() < 0.25) {
          primeTakeoverUntil = action.now + 24 * 60 * 60 * 1000;
          primeTakeoverVisitsRemaining = 0;
        } else {
          primeTakeoverVisitsRemaining = 3;
          primeTakeoverUntil = 0;
        }
      }
      return {
        ...state,
        meta: {
          ...state.meta,
          crewActivitySeed,
          crewActivityByAlly,
          activeCrewRumor: state.meta.activeCrewRumor ?? rollCrewRumor(
            state.meta.rescuedAllyIds,
            crewActivityByAlly,
            crewActivitySeed,
          ),
          hideoutVisitCount,
          primeTakeoverVisitsRemaining,
          primeTakeoverUntil,
        },
      };
    }

    case 'markOnboarded':
      return { ...state, meta: { ...state.meta, onboarded: true } };

    case 'reset':
      return { meta: createInitialMeta(), lastRun: null };

    case 'clearLastRun':
      return { ...state, lastRun: null };

    case 'spendTokens': {
      const cost = action.amount;
      if (state.meta.lootTokens < cost) return state;
      return { ...state, meta: { ...state.meta, lootTokens: state.meta.lootTokens - cost } };
    }

    case 'buyVendorItem': {
      const item = VENDOR_CATALOG_BY_ID[action.id];
      if (!item) return state;
      if (item.requires && vendorPurchaseCount(state.meta, item.requires) <= 0) return state;
      const owned = Math.min(item.maxStacks, Math.max(0, Math.floor(state.meta.vendorPurchases[item.id] ?? 0)));
      const currency = item.currency ?? 'cred';
      const balance = state.meta[currency];
      if (owned >= item.maxStacks || balance < item.cost) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          [currency]: balance - item.cost,
          vendorPurchases: { ...state.meta.vendorPurchases, [item.id]: owned + 1 },
        },
      };
    }

    case 'refundVendorItem': {
      const item = VENDOR_CATALOG_BY_ID[action.id];
      if (!item) return state;
      const owned = Math.min(item.maxStacks, Math.max(0, Math.floor(state.meta.vendorPurchases[item.id] ?? 0)));
      if (owned <= 0) return state;
      const nextOwned = owned - 1;
      const vendorPurchases = { ...state.meta.vendorPurchases };
      if (nextOwned > 0) vendorPurchases[item.id] = nextOwned;
      else delete vendorPurchases[item.id];
      const currency = item.currency ?? 'cred';
      return {
        ...state,
        meta: {
          ...state.meta,
          [currency]: state.meta[currency] + item.cost,
          vendorPurchases,
        },
      };
    }

    case 'refundAllVendorItems': {
      const refundByCurrency: Partial<Record<'cred' | 'skeletonKeys', number>> = {};
      for (const item of VENDOR_CATALOG) {
        const owned = Math.min(item.maxStacks, Math.max(0, Math.floor(state.meta.vendorPurchases[item.id] ?? 0)));
        if (owned <= 0) continue;
        const currency = item.currency ?? 'cred';
        refundByCurrency[currency] = (refundByCurrency[currency] ?? 0) + owned * item.cost;
      }
      if (Object.keys(refundByCurrency).length === 0) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          cred: state.meta.cred + (refundByCurrency.cred ?? 0),
          skeletonKeys: state.meta.skeletonKeys + (refundByCurrency.skeletonKeys ?? 0),
          vendorPurchases: {},
        },
      };
    }

    case 'setUiPanelLayout':
      return { ...state, meta: { ...state.meta, uiPanelLayout: action.layout } };

    case 'buyUiTheme': {
      const theme = UI_THEMES_BY_ID[action.id];
      if (!theme || state.meta.ownedUiThemeIds.includes(theme.id) || state.meta.cred < theme.cost) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          cred: state.meta.cred - theme.cost,
          ownedUiThemeIds: [...state.meta.ownedUiThemeIds, theme.id],
        },
      };
    }

    case 'equipUiTheme':
      if (!hasCatalogItem(state.meta, 'uiThemes', action.id, state.meta.ownedUiThemeIds)) return state;
      return { ...state, meta: { ...state.meta, uiTheme: action.id } };

    case 'selectUiThemeSwatch': {
      const theme = UI_THEMES_BY_ID[action.themeId];
      if (!theme?.swatches?.some((swatch) => swatch.id === action.swatchId)) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          uiThemeSwatchByTheme: { ...state.meta.uiThemeSwatchByTheme, [action.themeId]: action.swatchId },
        },
      };
    }

    case 'buyPalette': {
      const palette = THEMED_PALETTES_BY_ID[action.id];
      if (!palette || state.meta.ownedPaletteIds.includes(palette.id) || state.meta.lootTokens < palette.cost) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          lootTokens: state.meta.lootTokens - palette.cost,
          ownedPaletteIds: [...state.meta.ownedPaletteIds, palette.id],
        },
      };
    }

    case 'equipPalette':
      if (!hasCatalogItem(state.meta, 'palettes', action.id, state.meta.ownedPaletteIds)) return state;
      return { ...state, meta: { ...state.meta, activePaletteId: action.id } };

    case 'buyRunAura': {
      const aura = RUN_AURAS_BY_ID[action.id];
      if (!aura || state.meta.ownedRunAuraIds.includes(aura.id) || state.meta.lootTokens < aura.cost) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          lootTokens: state.meta.lootTokens - aura.cost,
          ownedRunAuraIds: [...state.meta.ownedRunAuraIds, aura.id],
        },
      };
    }

    case 'equipRunAura':
      if (!hasCatalogItem(state.meta, 'runAuras', action.id, state.meta.ownedRunAuraIds)) return state;
      return { ...state, meta: { ...state.meta, activeRunAuraId: action.id } };

    case 'buyHat': {
      const hat = HATS_BY_ID[action.id];
      if (!hat || state.meta.ownedHatIds.includes(hat.id) || state.meta.lootTokens < hat.cost) return state;
      return { ...state, meta: { ...state.meta, lootTokens: state.meta.lootTokens - hat.cost, ownedHatIds: [...state.meta.ownedHatIds, hat.id] } };
    }
    case 'equipHat':
      if (!hasCatalogItem(state.meta, 'hats', action.id, state.meta.ownedHatIds)) return state;
      return { ...state, meta: { ...state.meta, activeHatId: action.id } };
    case 'buyCelebration': {
      const celebration = CELEBRATIONS_BY_ID[action.id];
      if (!celebration || state.meta.ownedCelebrationIds.includes(celebration.id) || state.meta.lootTokens < celebration.cost) return state;
      return { ...state, meta: { ...state.meta, lootTokens: state.meta.lootTokens - celebration.cost, ownedCelebrationIds: [...state.meta.ownedCelebrationIds, celebration.id] } };
    }
    case 'equipCelebration':
      if (!hasCatalogItem(state.meta, 'celebrations', action.id, state.meta.ownedCelebrationIds)) return state;
      return { ...state, meta: { ...state.meta, activeCelebrationId: action.id } };

    case 'cycleUiLook': {
      const looks = uiLooksForOwnedThemeIds(effectiveCatalogIds(state.meta, 'uiThemes', state.meta.ownedUiThemeIds));
      if (looks.length <= 1) return state;
      const currentSwatchId = activeUiThemeSwatchId(state.meta);
      const currentIndex = looks.findIndex(
        (look) => look.themeId === state.meta.uiTheme && look.swatchId === currentSwatchId,
      );
      const next = looks[(currentIndex + 1 + looks.length) % looks.length] ?? looks[0];
      return {
        ...state,
        meta: {
          ...state.meta,
          uiTheme: next.themeId,
          ...(next.swatchId
            ? {
                uiThemeSwatchByTheme: {
                  ...state.meta.uiThemeSwatchByTheme,
                  [next.themeId]: next.swatchId,
                },
              }
            : {}),
        },
      };
    }

    case 'unlockDevModeAccess':
      return { ...state, meta: { ...state.meta, devModeAccessUnlocked: true } };

    case 'setDevModeAllUnlocks':
      if (!state.meta.devModeAccessUnlocked) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          devModeAllUnlocks: action.enabled,
          ...(!action.enabled
            ? {
                uiTheme: state.meta.ownedUiThemeIds.includes(state.meta.uiTheme) ? state.meta.uiTheme : DEFAULT_UI_THEME_ID,
                activePaletteId: state.meta.ownedPaletteIds.includes(state.meta.activePaletteId) ? state.meta.activePaletteId : DEFAULT_PALETTE_ID,
                activeRunAuraId: state.meta.ownedRunAuraIds.includes(state.meta.activeRunAuraId) ? state.meta.activeRunAuraId : DEFAULT_RUN_AURA_ID,
              }
            : {}),
        },
      };

    case 'setPhysicsObjectClicks':
      return {
        ...state,
        meta: { ...state.meta, physicsObjectClicksEnabled: action.enabled },
      };

    case 'setLevelUpPauses':
      return {
        ...state, meta: { ...state.meta, levelUpPausesEnabled: action.enabled, levelUpPresentation: action.enabled ? 'pause-focus' : 'compact-live' },
      };

    case 'setLiveMode':
      return { ...state, meta: { ...state.meta, liveModeEnabled: action.enabled, ...(action.enabled ? { lootPresentation: 'queue' as const, levelUpPausesEnabled: false, levelUpPresentation: state.meta.levelUpPresentation === 'random-live' ? 'random-live' as const : 'compact-live' as const } : {}) } };
    case 'setLootPresentation':
      return { ...state, meta: { ...state.meta, lootPresentation: action.value } };
    case 'setLevelUpPresentation':
      return {
        ...state,
        meta: {
          ...state.meta,
          levelUpPresentation: state.meta.liveModeEnabled && action.value === 'pause-focus' ? 'compact-live' : action.value,
          levelUpPausesEnabled: !state.meta.liveModeEnabled && action.value === 'pause-focus',
        },
      };
    case 'setPauseMapVisible':
      return { ...state, meta: { ...state.meta, pauseMapVisible: action.enabled } };

    case 'setWildlifeSheltersInRain':
      return {
        ...state,
        meta: { ...state.meta, wildlifeSheltersInRain: action.enabled },
      };

    case 'setMusicReactive':
      return { ...state, meta: { ...state.meta, musicReactiveEnabled: action.enabled } };

    case 'setHideoutAmbience':
      return { ...state, meta: { ...state.meta, hideoutAmbienceEnabled: action.enabled } };

    case 'setPaletteAnimations':
      return { ...state, meta: { ...state.meta, paletteAnimationsEnabled: action.enabled } };

    case 'setWorldPaletteBlend':
      return { ...state, meta: { ...state.meta, worldPaletteBlendEnabled: action.enabled } };

    case 'setGyroEnabled':
      return { ...state, meta: { ...state.meta, gyroEnabled: action.enabled } };

    case 'setStudioPlugins':
      return { ...state, meta: { ...state.meta, studioPluginsEnabled: action.enabled } };

    case 'setGyroSensitivity':
      return {
        ...state,
        meta: { ...state.meta, gyroSensitivity: clampGyroSensitivity(action.value) },
      };

    case 'setGyroInvertY':
      return { ...state, meta: { ...state.meta, gyroInvertY: action.enabled } };

    case 'setMinimapVisible':
      return {
        ...state,
        meta: { ...state.meta, minimapVisible: action.enabled },
      };

    case 'setMinimapExpanded':
      return {
        ...state,
        meta: { ...state.meta, minimapExpanded: action.enabled },
      };

    case 'setMinimapPosition':
      return {
        ...state,
        meta: {
          ...state.meta,
          minimapPosition: normalizedPosition(action.position, state.meta.minimapPosition),
        },
      };

    case 'setUiDensity':
      return {
        ...state,
        meta: { ...state.meta, uiDensity: action.density },
      };

    case 'setWorldInvertEnabled':
      if (action.enabled && vendorPurchaseCount(state.meta, 'invert-world') <= 0) return state;
      return { ...state, meta: { ...state.meta, worldInvertEnabled: action.enabled } };

    case 'setPaletteInvertEnabled':
      if (action.enabled && vendorPurchaseCount(state.meta, 'invert-palette') <= 0) return state;
      return { ...state, meta: { ...state.meta, paletteInvertEnabled: action.enabled } };

    case 'tickRecovery':
      return { ...state, meta: settleRecovery(state.meta, action.now) };

    case 'startRecovery': {
      const settled = settleRecovery(state.meta);
      if (!settled.unlockedCharacterIds.includes(action.characterId)) return state;
      return {
        ...state,
        meta: {
          ...settled,
          recovery: {
            characterId: action.characterId,
            locationId: action.locationId ?? 'rooftop',
            startedAt: Date.now(),
            lastUpdatedAt: Date.now(),
          },
        },
      };
    }

    case 'stopRecovery':
      {
        const settled = settleRecovery(state.meta);
        return { ...state, meta: { ...settled, recovery: { ...settled.recovery, characterId: null, startedAt: null } } };
      }

    case 'upgradeFacility': {
      const currentIndex = facilityIndex(state.meta.facilityTier);
      const nextFacility = RECOVERY_FACILITIES[currentIndex + 1];
      if (!nextFacility || state.meta.cred < nextFacility.cost) return state;
      return {
        ...state,
        meta: { ...state.meta, cred: state.meta.cred - nextFacility.cost, facilityTier: nextFacility.id },
      };
    }

    case 'createCustomMap': {
      if (state.meta.customMaps.length >= MAX_CUSTOM_MAPS) return state;
      const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const map = normalizeCustomMap({ id, name: `Night route ${state.meta.customMaps.length + 1}` }, id);
      return map
        ? { ...state, meta: { ...state.meta, customMaps: [map, ...state.meta.customMaps] } }
        : state;
    }

    case 'saveCustomMap': {
      const map = normalizeCustomMap({ ...action.map, updatedAt: Date.now() }, action.map.id);
      if (!map) return state;
      const index = state.meta.customMaps.findIndex((candidate) => candidate.id === map.id);
      if (index < 0 && state.meta.customMaps.length >= MAX_CUSTOM_MAPS) return state;
      const customMaps = index < 0
        ? [map, ...state.meta.customMaps]
        : state.meta.customMaps.map((candidate, candidateIndex) => candidateIndex === index ? map : candidate);
      return { ...state, meta: { ...state.meta, customMaps } };
    }

    case 'duplicateCustomMap': {
      if (state.meta.customMaps.length >= MAX_CUSTOM_MAPS) return state;
      const source = state.meta.customMaps.find((map) => map.id === action.id);
      if (!source) return state;
      const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const copy = normalizeCustomMap({
        ...source,
        id,
        name: `${source.name} copy`,
        placements: source.placements.map((placement) => ({ ...placement, id: `${placement.id}-copy` })),
      }, id);
      return copy
        ? { ...state, meta: { ...state.meta, customMaps: [copy, ...state.meta.customMaps] } }
        : state;
    }

    case 'deleteCustomMap':
      return {
        ...state,
        meta: { ...state.meta, customMaps: state.meta.customMaps.filter((map) => map.id !== action.id) },
      };

    case 'completeRun': {
      const result = action.result;
      const prev = state.meta;

      const bestiary = { ...prev.bestiary };
      for (const [enemyId, count] of Object.entries(result.killsByEnemy)) {
        bestiary[enemyId] = (bestiary[enemyId] ?? 0) + count;
      }

      let rescuedAllyIds = prev.rescuedAllyIds;
      if (result.rescuedAllyId) {
        rescuedAllyIds = addUnique(rescuedAllyIds, result.rescuedAllyId);
      }

      let discoveryIds = prev.discoveryIds;
      if (result.cleared && result.discoveryId) {
        discoveryIds = addUnique(discoveryIds, result.discoveryId);
      }
      const discoveredRelic = result.cleared && result.discoveryId
        ? RELIC_BY_DISCOVERY_ID[result.discoveryId]
        : undefined;
      const knownRelicIds = discoveredRelic
        ? addUnique(prev.knownRelicIds, discoveredRelic.id)
        : prev.knownRelicIds;
      const endlessDiscoveryIds = result.endless
        ? [...new Set([
            ...prev.endlessDiscoveryIds,
            ...result.endless.discoveredBandIds,
            ...result.endless.discoveredRouteEventIds,
          ])]
        : prev.endlessDiscoveryIds;
      const dailyContracts = advanceDailyContracts(
        {
          dayKey: prev.dailyContractDayKey,
          progressById: prev.dailyContractProgressById,
          completedIds: prev.completedDailyContractIds,
        },
        result,
      );

      const clearedAreaIds = result.cleared
        ? addUnique(prev.clearedAreaIds, result.areaId)
        : prev.clearedAreaIds;
      const lokPetCatalog = recordLokPetCatalog(prev.lokPetCatalog, result.lokPets);
      const recoveredElixirs = replenishPetElixirs(prev);
      const spentPetIds = new Set(prev.selectedLokPetIds);
      const savedLokPets = [
        ...result.lokPets
          .filter((pet) => pet.origin === 'chest')
          .map((pet, index) => ({ id: `pet-${Date.now().toString(36)}-${index}-${pet.variantId}`, roll: pet.roll, stamina: PET_STAMINA_MAX })),
        ...prev.savedLokPets.map((pet) => spentPetIds.has(pet.id) ? { ...pet, stamina: Math.max(0, pet.stamina - 1) } : pet),
      ].slice(0, 48);
      const selectedLokPetIds = prev.selectedLokPetIds.filter((id) => savedLokPets.some((pet) => pet.id === id && pet.stamina > 0));
      const lokPetDiscoveries = getLokPetDiscoveries(prev.lokPetCatalog, result.lokPets);
      const lokPetHistory = lokPetDiscoveries.length > 0
        ? [
            {
              runNumber: prev.totalRuns + 1,
              recordedAt: Date.now(),
              areaId: result.areaId,
              characterId: result.characterId,
              cleared: result.cleared,
              discoveries: lokPetDiscoveries,
            },
            ...prev.lokPetHistory,
          ].slice(0, 100)
        : prev.lokPetHistory;

      const next: MetaState = {
        ...prev,
        bestiary,
        rescuedAllyIds,
        discoveryIds,
        lokPetCatalog,
        lokPetHistory,
        savedLokPets,
        selectedLokPetIds,
        ...recoveredElixirs,
        clearedAreaIds,
        totalKills: prev.totalKills + result.kills,
        totalRuns: prev.totalRuns + 1,
        bestSurvivalSec: Math.max(prev.bestSurvivalSec, Math.round(result.survivedSec)),
        cred: prev.cred + result.cred + dailyContracts.rewardCred,
        lootTokens: prev.lootTokens + result.lootTokensGained + dailyContracts.rewardTokens,
        skeletonKeys: prev.skeletonKeys + result.skeletonKeysGained,
        // Endless records
        endlessRecordDistancePx: result.endless
          ? Math.max(prev.endlessRecordDistancePx, result.endless.maxDistancePx)
          : prev.endlessRecordDistancePx,
        endlessRecordDepth: result.endless
          ? Math.max(prev.endlessRecordDepth, result.endless.dungeonDepth)
          : prev.endlessRecordDepth,
        endlessDiscoveryIds,
        fatigueByCharacter: {
          ...prev.fatigueByCharacter,
          [result.characterId]: Math.min(
            MAX_FATIGUE_PCT,
            (prev.fatigueByCharacter[result.characterId] ?? 0) + FATIGUE_PER_RUN_PCT,
          ),
        },
        discoveredHutIds: RECOVERY_HUTS.filter(
          (hut) => clearedAreaIds.includes(hut.areaId),
        ).map((hut) => hut.id),
        activeCrewRumor: result.crewRumor ? null : prev.activeCrewRumor,
        completedEpisodeIds: [...prev.completedEpisodeIds],
        unlockedEvolutionIds: [...prev.unlockedEvolutionIds],
        episodeProgressById: { ...prev.episodeProgressById },
        knownRelicIds,
        dailyContractDayKey: dailyContracts.dayKey,
        dailyContractProgressById: dailyContracts.progressById,
        completedDailyContractIds: dailyContracts.completedIds,
      };

      const episodeDefinition = validEpisodeResult(result);
      if (episodeDefinition && result.episode) {
        const nextProgress = Math.max(
          next.episodeProgressById[episodeDefinition.id] ?? 0,
          Math.min(episodeDefinition.objective.targetCount, Math.max(0, Math.floor(result.episode.progress))),
        );
        next.episodeProgressById[episodeDefinition.id] = nextProgress;
        if (result.episode.completed && result.episode.completedThisRun) {
          next.completedEpisodeIds = addUnique(next.completedEpisodeIds, episodeDefinition.id);
          next.unlockedEvolutionIds = addUnique(next.unlockedEvolutionIds, episodeDefinition.evolutionId);
        }
      }

      // Characters whose unlock rule just became true.
      const newlyUnlocked = CHARACTERS.filter(
        (c) => !next.unlockedCharacterIds.includes(c.id) && isUnlocked(c.unlock, next),
      ).map((c) => c.id);

      next.unlockedCharacterIds = [...next.unlockedCharacterIds, ...newlyUnlocked];

      return {
        meta: next,
        lastRun: {
          ...result,
          lokPetDiscoveries,
          newlyUnlockedCharacterIds: newlyUnlocked,
          newlyDiscoveredRelicIds: discoveredRelic && !prev.knownRelicIds.includes(discoveredRelic.id)
            ? [discoveredRelic.id]
            : [],
        },
      };
    }

    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

export interface MetaContextValue {
  meta: MetaState;
  lastRun: RunResult | null;
  selectedCharacter: CharacterDef;
  unlockedCharacters: CharacterDef[];
  lockedCharacters: CharacterDef[];
  unlockedAreas: AreaDef[];
  lockedAreas: AreaDef[];
  unlockedRooms: HubRoomDef[];
  lockedRooms: HubRoomDef[];
  rescuedAllies: AllyDef[];
  missingAllies: AllyDef[];
  dailyContracts: ReturnType<typeof dailyContractStatuses>;
  enterHideout: () => void;
  selectCharacter: (id: string) => void;
  selectCharacterSkin: (characterId: string, skinId: string) => void;
  completeRun: (result: RunResult) => void;
  toggleSavedLokPet: (id: string) => void;
  restoreSavedLokPet: (id: string) => void;
  refreshPetElixirs: () => void;
  clearLastRun: () => void;
  markOnboarded: () => void;
  spendTokens: (amount: number) => void;
  buyVendorItem: (id: string) => void;
  refundVendorItem: (id: string) => void;
  refundAllVendorItems: () => void;
  setUiPanelLayout: (layout: UIPanelLayout) => void;
  buyUiTheme: (id: string) => void;
  equipUiTheme: (id: string) => void;
  selectUiThemeSwatch: (themeId: string, swatchId: string) => void;
  buyPalette: (id: string) => void;
  equipPalette: (id: string) => void;
  buyRunAura: (id: string) => void;
  equipRunAura: (id: string) => void;
  buyHat: (id: string) => void;
  equipHat: (id: string) => void;
  buyCelebration: (id: string) => void;
  equipCelebration: (id: string) => void;
  cycleUiLook: () => void;
  unlockDevModeAccess: () => void;
  setDevModeAllUnlocks: (enabled: boolean) => void;
  setPhysicsObjectClicks: (enabled: boolean) => void;
  setLevelUpPauses: (enabled: boolean) => void;
  setLiveMode: (enabled: boolean) => void;
  setLootPresentation: (value: MetaState['lootPresentation']) => void;
  setLevelUpPresentation: (value: MetaState['levelUpPresentation']) => void;
  setPauseMapVisible: (enabled: boolean) => void;
  setWildlifeSheltersInRain: (enabled: boolean) => void;
  setMinimapVisible: (enabled: boolean) => void;
  setMusicReactive: (enabled: boolean) => void;
  setHideoutAmbience: (enabled: boolean) => void;
  setPaletteAnimations: (enabled: boolean) => void;
  setWorldPaletteBlend: (enabled: boolean) => void;
  setGyroEnabled: (enabled: boolean) => void;
  setStudioPlugins: (enabled: boolean) => void;
  setGyroSensitivity: (value: number) => void;
  setGyroInvertY: (enabled: boolean) => void;
  setMinimapExpanded: (enabled: boolean) => void;
  setMinimapPosition: (position: { x: number; y: number }) => void;
  setWorldInvertEnabled: (enabled: boolean) => void;
  setPaletteInvertEnabled: (enabled: boolean) => void;
  setUiDensity: (density: 'grid' | 'list') => void;
  startRecovery: (characterId: string, locationId?: string) => void;
  stopRecovery: () => void;
  tickRecovery: () => void;
  upgradeFacility: () => void;
  createCustomMap: () => void;
  saveCustomMap: (map: CustomMap) => void;
  duplicateCustomMap: (id: string) => void;
  deleteCustomMap: (id: string) => void;
  resetProgress: () => void;
}

const MetaContext = createContext<MetaContextValue | null>(null);

export function MetaProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, null, () => ({
    meta: loadMeta(),
    lastRun: null,
  }));

  useEffect(() => {
    saveMeta(state.meta);
  }, [state.meta]);

  const selectCharacter = useCallback((id: string) => dispatch({ type: 'selectCharacter', id }), []);
  const selectCharacterSkin = useCallback((characterId: string, skinId: string) => dispatch({ type: 'selectCharacterSkin', characterId, skinId }), []);
  const enterHideout = useCallback(() => dispatch({ type: 'enterHideout', now: Date.now() }), []);
  const completeRun = useCallback((result: RunResult) => dispatch({ type: 'completeRun', result }), []);
  const toggleSavedLokPet = useCallback((id: string) => dispatch({ type: 'toggleSavedLokPet', id }), []);
  const restoreSavedLokPet = useCallback((id: string) => dispatch({ type: 'restoreSavedLokPet', id, now: Date.now() }), []);
  const refreshPetElixirs = useCallback(() => dispatch({ type: 'refreshPetElixirs', now: Date.now() }), []);
  const clearLastRun = useCallback(() => dispatch({ type: 'clearLastRun' }), []);
  const markOnboarded = useCallback(() => dispatch({ type: 'markOnboarded' }), []);
  const spendTokens = useCallback((amount: number) => dispatch({ type: 'spendTokens', amount }), []);
  const buyVendorItem = useCallback((id: string) => dispatch({ type: 'buyVendorItem', id }), []);
  const refundVendorItem = useCallback((id: string) => dispatch({ type: 'refundVendorItem', id }), []);
  const refundAllVendorItems = useCallback(() => dispatch({ type: 'refundAllVendorItems' }), []);
  const setUiPanelLayout = useCallback((layout: UIPanelLayout) => dispatch({ type: 'setUiPanelLayout', layout }), []);
  const buyUiTheme = useCallback((id: string) => dispatch({ type: 'buyUiTheme', id }), []);
  const equipUiTheme = useCallback((id: string) => dispatch({ type: 'equipUiTheme', id }), []);
  const selectUiThemeSwatch = useCallback(
    (themeId: string, swatchId: string) => dispatch({ type: 'selectUiThemeSwatch', themeId, swatchId }),
    [],
  );
  const buyPalette = useCallback((id: string) => dispatch({ type: 'buyPalette', id }), []);
  const equipPalette = useCallback((id: string) => dispatch({ type: 'equipPalette', id }), []);
  const buyRunAura = useCallback((id: string) => dispatch({ type: 'buyRunAura', id }), []);
  const equipRunAura = useCallback((id: string) => dispatch({ type: 'equipRunAura', id }), []);
  const buyHat = useCallback((id: string) => dispatch({ type: 'buyHat', id }), []);
  const equipHat = useCallback((id: string) => dispatch({ type: 'equipHat', id }), []);
  const buyCelebration = useCallback((id: string) => dispatch({ type: 'buyCelebration', id }), []);
  const equipCelebration = useCallback((id: string) => dispatch({ type: 'equipCelebration', id }), []);
  const cycleUiLook = useCallback(() => dispatch({ type: 'cycleUiLook' }), []);
  const unlockDevModeAccess = useCallback(() => dispatch({ type: 'unlockDevModeAccess' }), []);
  const setDevModeAllUnlocks = useCallback(
    (enabled: boolean) => dispatch({ type: 'setDevModeAllUnlocks', enabled }),
    [],
  );
  const setPhysicsObjectClicks = useCallback(
    (enabled: boolean) => dispatch({ type: 'setPhysicsObjectClicks', enabled }),
    [],
  );
  const setLevelUpPauses = useCallback(
    (enabled: boolean) => dispatch({ type: 'setLevelUpPauses', enabled }),
    [],
  );
  const setLiveMode = useCallback((enabled: boolean) => dispatch({ type: 'setLiveMode', enabled }), []);
  const setLootPresentation = useCallback((value: MetaState['lootPresentation']) => dispatch({ type: 'setLootPresentation', value }), []);
  const setLevelUpPresentation = useCallback((value: MetaState['levelUpPresentation']) => dispatch({ type: 'setLevelUpPresentation', value }), []);
  const setPauseMapVisible = useCallback((enabled: boolean) => dispatch({ type: 'setPauseMapVisible', enabled }), []);
  const setWildlifeSheltersInRain = useCallback(
    (enabled: boolean) => dispatch({ type: 'setWildlifeSheltersInRain', enabled }),
    [],
  );
  const setHideoutAmbience = useCallback(
    (enabled: boolean) => dispatch({ type: 'setHideoutAmbience', enabled }),
    [],
  );

  const setMusicReactive = useCallback(
    (enabled: boolean) => dispatch({ type: 'setMusicReactive', enabled }),
    [],
  );
  const setPaletteAnimations = useCallback((enabled: boolean) => dispatch({ type: 'setPaletteAnimations', enabled }), []);
  const setWorldPaletteBlend = useCallback((enabled: boolean) => dispatch({ type: 'setWorldPaletteBlend', enabled }), []);
  const setStudioPlugins = useCallback(
    (enabled: boolean) => dispatch({ type: 'setStudioPlugins', enabled }),
    [],
  );
  const setGyroEnabled = useCallback(
    (enabled: boolean) => dispatch({ type: 'setGyroEnabled', enabled }),
    [],
  );
  const setGyroSensitivity = useCallback(
    (value: number) => dispatch({ type: 'setGyroSensitivity', value }),
    [],
  );
  const setGyroInvertY = useCallback(
    (enabled: boolean) => dispatch({ type: 'setGyroInvertY', enabled }),
    [],
  );
  const setMinimapVisible = useCallback(
    (enabled: boolean) => dispatch({ type: 'setMinimapVisible', enabled }),
    [],
  );
  const setMinimapExpanded = useCallback(
    (enabled: boolean) => dispatch({ type: 'setMinimapExpanded', enabled }),
    [],
  );
  const setMinimapPosition = useCallback(
    (position: { x: number; y: number }) => dispatch({ type: 'setMinimapPosition', position }),
    [],
  );
  const setWorldInvertEnabled = useCallback(
    (enabled: boolean) => dispatch({ type: 'setWorldInvertEnabled', enabled }),
    [],
  );
  const setPaletteInvertEnabled = useCallback(
    (enabled: boolean) => dispatch({ type: 'setPaletteInvertEnabled', enabled }),
    [],
  );
  const setUiDensity = useCallback(
    (density: 'grid' | 'list') => dispatch({ type: 'setUiDensity', density }),
    [],
  );
  const startRecovery = useCallback((characterId: string, locationId?: string) => dispatch({ type: 'startRecovery', characterId, locationId }), []);
  const stopRecovery = useCallback(() => dispatch({ type: 'stopRecovery' }), []);
  const tickRecovery = useCallback(() => dispatch({ type: 'tickRecovery', now: Date.now() }), []);
  const upgradeFacility = useCallback(() => dispatch({ type: 'upgradeFacility' }), []);
  const createCustomMap = useCallback(() => dispatch({ type: 'createCustomMap' }), []);
  const saveCustomMap = useCallback((map: CustomMap) => dispatch({ type: 'saveCustomMap', map }), []);
  const duplicateCustomMap = useCallback((id: string) => dispatch({ type: 'duplicateCustomMap', id }), []);
  const deleteCustomMap = useCallback((id: string) => dispatch({ type: 'deleteCustomMap', id }), []);
  const resetProgress = useCallback(() => dispatch({ type: 'reset' }), []);

  const value = useMemo<MetaContextValue>(() => {
    const { meta } = state;
    const unlockedCharacters = CHARACTERS.filter((c) => isUnlocked(c.unlock, meta));
    const lockedCharacters = CHARACTERS.filter((c) => !isUnlocked(c.unlock, meta));
    const unlockedAreas = AREAS.filter((a) => isUnlocked(a.unlock, meta));
    const lockedAreas = AREAS.filter((a) => !isUnlocked(a.unlock, meta));
    const unlockedRooms = HUB_ROOMS.filter((r) => isUnlocked(r.unlock, meta));
    const lockedRooms = HUB_ROOMS.filter((r) => !isUnlocked(r.unlock, meta));
    const rescuedAllies = ALLIES.filter((a) => meta.rescuedAllyIds.includes(a.id));
    const missingAllies = ALLIES.filter((a) => !meta.rescuedAllyIds.includes(a.id));
    const dailyContracts = dailyContractStatuses({
      dayKey: meta.dailyContractDayKey,
      progressById: meta.dailyContractProgressById,
      completedIds: meta.completedDailyContractIds,
    });

    const selectedCharacter = unlockedCharacters.some((c) => c.id === meta.selectedCharacterId)
      ? getCharacter(meta.selectedCharacterId)
      : (unlockedCharacters[0] ?? getCharacter('shade'));

    return {
      meta,
      lastRun: state.lastRun,
      selectedCharacter,
      unlockedCharacters,
      lockedCharacters,
      unlockedAreas,
      lockedAreas,
      unlockedRooms,
      lockedRooms,
      rescuedAllies,
      missingAllies,
      dailyContracts,
      enterHideout,
      selectCharacter,
      selectCharacterSkin,
      completeRun,
      toggleSavedLokPet,
      restoreSavedLokPet,
      refreshPetElixirs,
      clearLastRun,
      markOnboarded,
      spendTokens,
      buyVendorItem,
      refundVendorItem,
      refundAllVendorItems,
      setUiPanelLayout,
      buyUiTheme,
      equipUiTheme,
      selectUiThemeSwatch,
      buyPalette,
      equipPalette,
      buyRunAura,
      equipRunAura,
      buyHat,
      equipHat,
      buyCelebration,
      equipCelebration,
      cycleUiLook,
      unlockDevModeAccess,
      setDevModeAllUnlocks,
      setPhysicsObjectClicks,
      setLevelUpPauses,
      setLiveMode,
      setLootPresentation,
      setLevelUpPresentation,
      setPauseMapVisible,
      setWildlifeSheltersInRain,
      setMinimapVisible,
      setMusicReactive,
      setHideoutAmbience,
      setPaletteAnimations,
      setWorldPaletteBlend,
      setGyroEnabled,
      setStudioPlugins,
      setGyroSensitivity,
      setGyroInvertY,
      setMinimapExpanded,
      setMinimapPosition,
      setWorldInvertEnabled,
      setPaletteInvertEnabled,
      setUiDensity,
      resetProgress,
      startRecovery,
      stopRecovery,
      tickRecovery,
      upgradeFacility,
      createCustomMap,
      saveCustomMap,
      duplicateCustomMap,
      deleteCustomMap,
    };
  }, [
    state,
    selectCharacter,
    enterHideout,
    selectCharacterSkin,
    completeRun,
    toggleSavedLokPet,
    restoreSavedLokPet,
    refreshPetElixirs,
    clearLastRun,
    markOnboarded,
    spendTokens,
    buyVendorItem,
    refundVendorItem,
    refundAllVendorItems,
    setUiPanelLayout,
    buyUiTheme,
    equipUiTheme,
    selectUiThemeSwatch,
    buyPalette,
    equipPalette,
    buyRunAura,
    equipRunAura,
    buyHat,
    equipHat,
    buyCelebration,
    equipCelebration,
    cycleUiLook,
    unlockDevModeAccess,
    setDevModeAllUnlocks,
    setPhysicsObjectClicks,
    setLevelUpPauses,
    setLiveMode,
    setLootPresentation,
    setLevelUpPresentation,
    setPauseMapVisible,
    setWildlifeSheltersInRain,
    setMinimapVisible,
    setMusicReactive,
    setHideoutAmbience,
    setPaletteAnimations,
    setWorldPaletteBlend,
    setGyroEnabled,
    setGyroSensitivity,
    setGyroInvertY,
    setMinimapExpanded,
    setMinimapPosition,
    setWorldInvertEnabled,
    setPaletteInvertEnabled,
    setUiDensity,
    resetProgress,
    startRecovery,
    stopRecovery,
    tickRecovery,
    upgradeFacility,
    createCustomMap,
    saveCustomMap,
    duplicateCustomMap,
    deleteCustomMap,
  ]);

  return <MetaContext.Provider value={value}>{children}</MetaContext.Provider>;
}

export function useMeta(): MetaContextValue {
  const ctx = useContext(MetaContext);
  if (!ctx) {
    throw new Error('useMeta must be used inside <MetaProvider>');
  }
  return ctx;
}

/** The accent swatch id currently in effect for the player's equipped UI theme, if it offers any. */
export function activeUiThemeSwatchId(meta: MetaState): string | undefined {
  return meta.uiThemeSwatchByTheme[meta.uiTheme] ?? defaultSwatchId(meta.uiTheme);
}

/** Convenience for menus that need the area record plus its lock state. */
export function areaStatus(areaId: string, meta: MetaState) {
  const area = getArea(areaId);
  return {
    area,
    unlocked: isUnlocked(area.unlock, meta),
    cleared: meta.clearedAreaIds.includes(areaId),
  };
}
