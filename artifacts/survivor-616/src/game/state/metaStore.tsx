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
import { ALLIES, ALLIES_BY_ID, DISCOVERIES, HUB_ROOMS } from '@/game/data/progression';
import type {
  AllyDef,
  AreaDef,
  BaseStats,
  CharacterDef,
  HubRoomDef,
  MetaState,
  RunResult,
  UnlockRule,
} from '@/game/types';

const STORAGE_KEY = 'survivor616.meta.v1';
const META_VERSION = 1;

export function createInitialMeta(): MetaState {
  return {
    version: META_VERSION,
    selectedCharacterId: 'shade',
    unlockedCharacterIds: CHARACTERS.filter((c) => c.unlock.kind === 'default').map((c) => c.id),
    clearedAreaIds: [],
    rescuedAllyIds: [],
    discoveryIds: [],
    bestiary: {},
    totalKills: 0,
    totalRuns: 0,
    bestSurvivalSec: 0,
    cred: 0,
    lootTokens: 0,
    onboarded: false,
    endlessRecordDistancePx: 0,
    endlessRecordDepth: 0,
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

/** Coerce an untrusted save payload into a usable MetaState. */
function normalizeMeta(parsed: Partial<MetaState>): MetaState {
  const defaults = createInitialMeta();
  const characterIds = new Set(CHARACTERS.map((c) => c.id));
  const areaIds = new Set(AREAS.map((a) => a.id));
  const allyIds = new Set(ALLIES.map((a) => a.id));
  const discoveryIds = new Set(DISCOVERIES.map((d) => d.id));
  const enemyIds = new Set(ENEMIES.map((e) => e.id));

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
    selectedCharacterId,
    unlockedCharacterIds,
    clearedAreaIds: idList(parsed.clearedAreaIds, areaIds, []),
    rescuedAllyIds: idList(parsed.rescuedAllyIds, allyIds, []),
    discoveryIds: idList(parsed.discoveryIds, discoveryIds, []),
    bestiary,
    totalKills: counter(parsed.totalKills),
    totalRuns: counter(parsed.totalRuns),
    bestSurvivalSec: counter(parsed.bestSurvivalSec),
    cred: counter(parsed.cred),
    lootTokens: counter(parsed.lootTokens),
    onboarded: parsed.onboarded === true,
    endlessRecordDistancePx: counter(parsed.endlessRecordDistancePx),
    endlessRecordDepth: counter(parsed.endlessRecordDepth),
  };
}

function loadMeta(): MetaState {
  if (typeof window === 'undefined') return createInitialMeta();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialMeta();
    const parsed = JSON.parse(raw) as Partial<MetaState>;
    if (parsed === null || typeof parsed !== 'object') return createInitialMeta();
    if (parsed.version !== META_VERSION) return createInitialMeta();
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
  const boosts = allyBoostTotals(meta);
  const stats: BaseStats = { ...character.stats };
  for (const [key, value] of Object.entries(boosts) as Array<[keyof BaseStats, number]>) {
    stats[key] = stats[key] + value;
  }
  stats.armor = Math.min(stats.armor, 0.6);
  return stats;
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

      const next: MetaState = {
        ...prev,
        bestiary,
        rescuedAllyIds,
        discoveryIds,
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
  const resetProgress = useCallback(() => dispatch({ type: 'reset' }), []);

  const value = useMemo<MetaContextValue>(() => {
    const { meta } = state;
    const unlockedCharacters = CHARACTERS.filter((c) => meta.unlockedCharacterIds.includes(c.id));
    const lockedCharacters = CHARACTERS.filter((c) => !meta.unlockedCharacterIds.includes(c.id));
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
      resetProgress,
    };
  }, [state, selectCharacter, completeRun, clearLastRun, markOnboarded, spendTokens, resetProgress]);

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
