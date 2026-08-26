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
import { ENEMIES } from '@/game/data/enemies';
import { LOKPET_VARIANTS_BY_ID } from '@/game/data/lokPets';
import { ALLIES, ALLIES_BY_ID, DISCOVERIES, HUB_ROOMS } from '@/game/data/progression';
import {
  RECOVERY_FACILITIES,
  RECOVERY_FACILITIES_BY_ID,
  RECOVERY_HUTS,
} from '@/game/data/recovery';
import type {
  AllyDef,
  AreaDef,
  BaseStats,
  CharacterDef,
  HubRoomDef,
  LokPetAttackKind,
  LokPetCatalogEntry,
  LokPetCatalogTrait,
  LokPetElement,
  LokPetRarity,
  MetaState,
  RunResult,
  FacilityTier,
  RecoverySession,
  UnlockRule,
} from '@/game/types';

const STORAGE_KEY = 'survivor616.meta.v1';
const META_VERSION = 3;
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

export function createInitialMeta(): MetaState {
  return {
    version: META_VERSION,
    devModeAllUnlocks: false,
    selectedCharacterId: 'shade',
    unlockedCharacterIds: CHARACTERS.filter((c) => c.unlock.kind === 'default').map((c) => c.id),
    clearedAreaIds: [],
    rescuedAllyIds: [],
    discoveryIds: [],
    lokPetCatalog: [],
    bestiary: {},
    totalKills: 0,
    totalRuns: 0,
    bestSurvivalSec: 0,
    cred: 0,
    lootTokens: 0,
    onboarded: false,
    endlessRecordDistancePx: 0,
    endlessRecordDepth: 0,
    fatigueByCharacter: {},
    recovery: defaultRecovery(),
    facilityTier: 'tub',
    discoveredHutIds: [],
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

function counter(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

const LOKPET_RARITIES: LokPetRarity[] = ['common', 'charged', 'rare', 'mythic'];
const LOKPET_ATTACK_KINDS: LokPetAttackKind[] = ['shot', 'rapid-shot', 'heavy-shot', 'pulse', 'explosion'];
const LOKPET_ELEMENTS: LokPetElement[] = ['none', 'fire', 'freeze', 'slow'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isOneOf<T extends string>(value: unknown, values: T[]): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function catalogTraitKey(trait: Pick<LokPetCatalogTrait, 'attackKind' | 'element'>): string {
  return `${trait.attackKind}:${trait.element}`;
}

/**
 * Normalize catalog records independently from the rest of the save. The
 * variant sheet is the source of truth for presentation fields, so malformed
 * localStorage cannot inject a different palette or identity into the archive.
 */
function normalizeLokPetCatalog(value: unknown): LokPetCatalogEntry[] {
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
        const trait: LokPetCatalogTrait = {
          attackKind: traitValue.attackKind,
          element: traitValue.element,
          elementLabel: typeof traitValue.elementLabel === 'string' ? traitValue.elementLabel : traitValue.element,
          label: typeof traitValue.label === 'string' ? traitValue.label : traitValue.attackKind,
        };
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
    const trait: LokPetCatalogTrait = {
      attackKind: pet.attackKind,
      element: pet.element,
      elementLabel: pet.elementLabel,
      label: pet.traitLabel,
    };
    if (!entry.traits.some((candidate) => catalogTraitKey(candidate) === catalogTraitKey(trait))) {
      entry.traits.push(trait);
    }
    entries.set(variant.id, entry);
  }

  return [...entries.values()];
}

/** Coerce an untrusted save payload into a usable MetaState. */
function normalizeMeta(parsed: Partial<MetaState>): MetaState {
  const defaults = createInitialMeta();
  const characterIds = new Set(CHARACTERS.map((c) => c.id));
  const areaIds = new Set(AREAS.map((a) => a.id));
  const allyIds = new Set(ALLIES.map((a) => a.id));
  const discoveryIds = new Set(DISCOVERIES.map((d) => d.id));
  const enemyIds = new Set(ENEMIES.map((e) => e.id));
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

  return {
    version: META_VERSION,
    devModeAllUnlocks: import.meta.env.DEV && parsed.devModeAllUnlocks === true,
    selectedCharacterId,
    unlockedCharacterIds,
    clearedAreaIds: idList(parsed.clearedAreaIds, areaIds, []),
    rescuedAllyIds: idList(parsed.rescuedAllyIds, allyIds, []),
    discoveryIds: idList(parsed.discoveryIds, discoveryIds, []),
    lokPetCatalog: normalizeLokPetCatalog(parsed.lokPetCatalog),
    bestiary,
    totalKills: counter(parsed.totalKills),
    totalRuns: counter(parsed.totalRuns),
    bestSurvivalSec: counter(parsed.bestSurvivalSec),
    cred: counter(parsed.cred),
    lootTokens: counter(parsed.lootTokens),
    onboarded: parsed.onboarded === true,
    endlessRecordDistancePx: counter(parsed.endlessRecordDistancePx),
    endlessRecordDepth: counter(parsed.endlessRecordDepth),
    fatigueByCharacter,
    recovery,
    facilityTier: tier,
    discoveredHutIds,
  };
}

function loadMeta(): MetaState {
  if (typeof window === 'undefined') return createInitialMeta();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialMeta();
    const parsed = JSON.parse(raw) as Partial<MetaState>;
    if (parsed === null || typeof parsed !== 'object') return createInitialMeta();
    if (parsed.version !== META_VERSION && parsed.version !== 2 && parsed.version !== 1) return createInitialMeta();
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
  if (import.meta.env.DEV && meta.devModeAllUnlocks) return true;

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
  | { type: 'completeRun'; result: RunResult }
  | { type: 'clearLastRun' }
  | { type: 'markOnboarded' }
  | { type: 'spendTokens'; amount: number }
  | { type: 'setDevModeAllUnlocks'; enabled: boolean }
  | { type: 'startRecovery'; characterId: string; locationId?: string }
  | { type: 'stopRecovery' }
  | { type: 'tickRecovery'; now: number }
  | { type: 'upgradeFacility' }
  | { type: 'reset' };

function addUnique(list: string[], value?: string): string[] {
  if (!value || list.includes(value)) return list;
  return [...list, value];
}

function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case 'selectCharacter':
      return { ...state, meta: { ...state.meta, selectedCharacterId: action.id } };

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

    case 'setDevModeAllUnlocks':
      return {
        ...state,
        meta: { ...state.meta, devModeAllUnlocks: action.enabled },
      };

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

      const clearedAreaIds = result.cleared
        ? addUnique(prev.clearedAreaIds, result.areaId)
        : prev.clearedAreaIds;
      const lokPetCatalog = recordLokPetCatalog(prev.lokPetCatalog, result.lokPets);

      const next: MetaState = {
        ...prev,
        bestiary,
        rescuedAllyIds,
        discoveryIds,
        lokPetCatalog,
        clearedAreaIds,
        totalKills: prev.totalKills + result.kills,
        totalRuns: prev.totalRuns + 1,
        bestSurvivalSec: Math.max(prev.bestSurvivalSec, Math.round(result.survivedSec)),
        cred: prev.cred + result.cred,
        lootTokens: prev.lootTokens + result.lootTokensGained,
        // Endless records
        endlessRecordDistancePx: result.endless
          ? Math.max(prev.endlessRecordDistancePx, result.endless.maxDistancePx)
          : prev.endlessRecordDistancePx,
        endlessRecordDepth: result.endless
          ? Math.max(prev.endlessRecordDepth, result.endless.dungeonDepth)
          : prev.endlessRecordDepth,
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
      };

      // Characters whose unlock rule just became true.
      const newlyUnlocked = CHARACTERS.filter(
        (c) => !next.unlockedCharacterIds.includes(c.id) && isUnlocked(c.unlock, next),
      ).map((c) => c.id);

      next.unlockedCharacterIds = [...next.unlockedCharacterIds, ...newlyUnlocked];

      return {
        meta: next,
        lastRun: { ...result, newlyUnlockedCharacterIds: newlyUnlocked },
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
  selectCharacter: (id: string) => void;
  completeRun: (result: RunResult) => void;
  clearLastRun: () => void;
  markOnboarded: () => void;
  spendTokens: (amount: number) => void;
  setDevModeAllUnlocks: (enabled: boolean) => void;
  startRecovery: (characterId: string, locationId?: string) => void;
  stopRecovery: () => void;
  tickRecovery: () => void;
  upgradeFacility: () => void;
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
  const completeRun = useCallback((result: RunResult) => dispatch({ type: 'completeRun', result }), []);
  const clearLastRun = useCallback(() => dispatch({ type: 'clearLastRun' }), []);
  const markOnboarded = useCallback(() => dispatch({ type: 'markOnboarded' }), []);
  const spendTokens = useCallback((amount: number) => dispatch({ type: 'spendTokens', amount }), []);
  const setDevModeAllUnlocks = useCallback(
    (enabled: boolean) => dispatch({ type: 'setDevModeAllUnlocks', enabled }),
    [],
  );
  const startRecovery = useCallback((characterId: string, locationId?: string) => dispatch({ type: 'startRecovery', characterId, locationId }), []);
  const stopRecovery = useCallback(() => dispatch({ type: 'stopRecovery' }), []);
  const tickRecovery = useCallback(() => dispatch({ type: 'tickRecovery', now: Date.now() }), []);
  const upgradeFacility = useCallback(() => dispatch({ type: 'upgradeFacility' }), []);
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
      selectCharacter,
      completeRun,
      clearLastRun,
      markOnboarded,
      spendTokens,
      setDevModeAllUnlocks,
      resetProgress,
      startRecovery,
      stopRecovery,
      tickRecovery,
      upgradeFacility,
    };
  }, [
    state,
    selectCharacter,
    completeRun,
    clearLastRun,
    markOnboarded,
    spendTokens,
    setDevModeAllUnlocks,
    resetProgress,
    startRecovery,
    stopRecovery,
    tickRecovery,
    upgradeFacility,
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

/** Convenience for menus that need the area record plus its lock state. */
export function areaStatus(areaId: string, meta: MetaState) {
  const area = getArea(areaId);
  return {
    area,
    unlocked: isUnlocked(area.unlock, meta),
    cleared: meta.clearedAreaIds.includes(areaId),
  };
}
