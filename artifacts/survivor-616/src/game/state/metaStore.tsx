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
import { VENDOR_CATALOG, VENDOR_CATALOG_BY_ID } from '@/game/data/vendor';
import type {
  AllyDef,
  AreaDef,
  BaseStats,
  CharacterDef,
  HubRoomDef,
  LokPetAttackKind,
  LokPetCatalogEntry,
  LokPetCatalogTrait,
  LokPetDiscoveryHistoryEntry,
  LokPetElement,
  LokPetRarity,
  LokPetRunDiscovery,
  MetaState,
  RunResult,
  FacilityTier,
  RecoverySession,
  UnlockRule,
} from '@/game/types';

const STORAGE_KEY = 'survivor616.meta.v1';
const META_VERSION = 4;
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
    physicsObjectClicksEnabled: true,
    selectedCharacterId: 'shade',
    unlockedCharacterIds: CHARACTERS.filter((c) => c.unlock.kind === 'default').map((c) => c.id),
    clearedAreaIds: [],
    rescuedAllyIds: [],
    discoveryIds: [],
    lokPetCatalog: [],
    lokPetHistory: [],
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
    vendorPurchases: {},
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

/** Coerce an untrusted save payload into a usable MetaState. */
export function normalizeMeta(parsed: Partial<MetaState>): MetaState {
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
    devModeAllUnlocks: Boolean(import.meta.env?.DEV) && parsed.devModeAllUnlocks === true,
    physicsObjectClicksEnabled: parsed.physicsObjectClicksEnabled !== false,
    selectedCharacterId,
    unlockedCharacterIds,
    clearedAreaIds: idList(parsed.clearedAreaIds, areaIds, []),
    rescuedAllyIds: idList(parsed.rescuedAllyIds, allyIds, []),
    discoveryIds: idList(parsed.discoveryIds, discoveryIds, []),
    lokPetCatalog: normalizeLokPetCatalog(parsed.lokPetCatalog),
    lokPetHistory: normalizeLokPetHistory(parsed.lokPetHistory),
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
    vendorPurchases: normalizeVendorPurchases(parsed.vendorPurchases),
  };
}

export function loadMeta(): MetaState {
  if (typeof window === 'undefined') return createInitialMeta();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialMeta();
    const parsed = JSON.parse(raw) as Partial<MetaState>;
    if (parsed === null || typeof parsed !== 'object') return createInitialMeta();
    if (parsed.version !== META_VERSION && parsed.version !== 3 && parsed.version !== 2 && parsed.version !== 1) return createInitialMeta();
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
  if (import.meta.env?.DEV && meta.devModeAllUnlocks) return true;

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
  | { type: 'buyVendorItem'; id: string }
  | { type: 'setDevModeAllUnlocks'; enabled: boolean }
  | { type: 'setPhysicsObjectClicks'; enabled: boolean }
  | { type: 'startRecovery'; characterId: string; locationId?: string }
  | { type: 'stopRecovery' }
  | { type: 'tickRecovery'; now: number }
  | { type: 'upgradeFacility' }
  | { type: 'reset' };

function addUnique(list: string[], value?: string): string[] {
  if (!value || list.includes(value)) return list;
  return [...list, value];
}

export function reducer(state: StoreState, action: Action): StoreState {
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

    case 'buyVendorItem': {
      const item = VENDOR_CATALOG_BY_ID[action.id];
      if (!item) return state;
      const owned = Math.min(item.maxStacks, Math.max(0, Math.floor(state.meta.vendorPurchases[item.id] ?? 0)));
      if (owned >= item.maxStacks || state.meta.cred < item.cost) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          cred: state.meta.cred - item.cost,
          vendorPurchases: { ...state.meta.vendorPurchases, [item.id]: owned + 1 },
        },
      };
    }

    case 'setDevModeAllUnlocks':
      return {
        ...state,
        meta: { ...state.meta, devModeAllUnlocks: action.enabled },
      };

    case 'setPhysicsObjectClicks':
      return {
        ...state,
        meta: { ...state.meta, physicsObjectClicksEnabled: action.enabled },
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
        lastRun: { ...result, lokPetDiscoveries, newlyUnlockedCharacterIds: newlyUnlocked },
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
  buyVendorItem: (id: string) => void;
  setDevModeAllUnlocks: (enabled: boolean) => void;
  setPhysicsObjectClicks: (enabled: boolean) => void;
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
  const buyVendorItem = useCallback((id: string) => dispatch({ type: 'buyVendorItem', id }), []);
  const setDevModeAllUnlocks = useCallback(
    (enabled: boolean) => dispatch({ type: 'setDevModeAllUnlocks', enabled }),
    [],
  );
  const setPhysicsObjectClicks = useCallback(
    (enabled: boolean) => dispatch({ type: 'setPhysicsObjectClicks', enabled }),
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
      buyVendorItem,
      setDevModeAllUnlocks,
      setPhysicsObjectClicks,
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
    buyVendorItem,
    setDevModeAllUnlocks,
    setPhysicsObjectClicks,
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
