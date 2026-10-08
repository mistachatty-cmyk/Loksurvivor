/**
 * Device-local storage for the Operator Forge and the other end-game extras:
 * which unlocks the save has earned, which of them the player has switched on,
 * and the custom operators kept in the earned slots.
 *
 * This is a plain module (no React) because the roster is built when
 * `data/characters.ts` loads, long before any component renders. Every
 * read tolerates a missing `localStorage` (tests, private windows) and
 * corrupt data, and never throws.
 */
import {
  HEX, MAX_FORGED_OPERATORS, PALETTE_KEYS, normalizeForgedOperator, type ForgedOperator,
} from '@/game/data/operatorForge';
import type { SpritePalette } from '@/game/types';
import { CUSTOM_SLOT_IDS, ENDGAME_FEATURE_IDS, type EndgameFeatureId } from '@/game/data/endgameUnlocks';

export const FORGE_STORAGE_KEY = 'survivor616.forge.v1';

/**
 * `unlocked` is the legacy "found the hidden workshop" flag from before the
 * Forge became an end-game unlock. It is still honored so nobody who already
 * had the Forge loses it. New access comes from `earned`.
 */
export interface ForgeState {
  unlocked: boolean;
  operators: ForgedOperator[];
  /** Sticky end-game unlock ids (features and custom slots). */
  earned: string[];
  /** Explicit on/off choices; a missing key means "use the default". */
  toggles: Partial<Record<EndgameFeatureId, boolean>>;
  /** Cosmetic recolors of classic enemies. Never change stats or behavior. */
  customEnemies: CustomVariant[];
  /** Cosmetic recolors of LokPet variants. */
  customPets: CustomVariant[];
  /** Which customs take part in runs. A missing id means on; the master switch turns every custom off at once. */
  runUse: RunUse;
  /** Show the Endgame dock in the hideout. Missing means on. */
  hideoutDock: boolean;
  /** Counters for forge achievements. They only ever go up. */
  stats: ForgeStats;
}

export interface RunUse {
  master: boolean;
  operators: Record<string, boolean>;
  enemies: Record<string, boolean>;
  pets: Record<string, boolean>;
}

export interface ForgeStats {
  tabsVisited: string[];
  shareCodes: number;
  classicSaved: number;
  detailedSaved: number;
  recolored: number;
}

export const EMPTY_STATS: ForgeStats = { tabsVisited: [], shareCodes: 0, classicSaved: 0, detailedSaved: 0, recolored: 0 };
const EMPTY_RUN_USE: RunUse = { master: true, operators: {}, enemies: {}, pets: {} };

function normalizeFlags(input: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for (const [key, value] of Object.entries(input as Record<string, unknown>).slice(0, 200)) {
    if (typeof value === 'boolean') out[key.slice(0, 64)] = value;
  }
  return out;
}

function normalizeRunUse(input: unknown): RunUse {
  const src = (input && typeof input === 'object' && !Array.isArray(input) ? input : {}) as Record<string, unknown>;
  return { master: src.master !== false, operators: normalizeFlags(src.operators), enemies: normalizeFlags(src.enemies), pets: normalizeFlags(src.pets) };
}

function normalizeStats(input: unknown): ForgeStats {
  const src = (input && typeof input === 'object' && !Array.isArray(input) ? input : {}) as Record<string, unknown>;
  const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(Math.floor(v), 1_000_000) : 0);
  const tabs = Array.isArray(src.tabsVisited) ? src.tabsVisited.filter((t): t is string => typeof t === 'string').slice(0, 8) : [];
  return { tabsVisited: [...new Set(tabs)], shareCodes: count(src.shareCodes), classicSaved: count(src.classicSaved), detailedSaved: count(src.detailedSaved), recolored: count(src.recolored) };
}

export type CustomVariantKind = 'enemy' | 'pet';

/** A saved recolor of an existing enemy or LokPet (the base keeps its rig, stats and behavior). */
export interface CustomVariant {
  id: string;
  baseId: string;
  name: string;
  palette: SpritePalette;
  createdAt: number;
}

export const MAX_CUSTOM_VARIANTS = 60;

function normalizeVariants(input: unknown): CustomVariant[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: CustomVariant[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    if (typeof raw.id !== 'string' || typeof raw.baseId !== 'string' || seen.has(raw.id)) continue;
    const pal = (raw.palette && typeof raw.palette === 'object' ? raw.palette : {}) as Record<string, unknown>;
    const palette = {} as SpritePalette;
    let valid = true;
    for (const key of PALETTE_KEYS) {
      const value = pal[key];
      if (typeof value === 'string' && HEX.test(value)) palette[key] = value;
      else valid = false;
    }
    if (!valid) continue;
    seen.add(raw.id);
    out.push({
      id: raw.id.slice(0, 64),
      baseId: raw.baseId.slice(0, 64),
      name: (typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'Custom').slice(0, 40),
      palette,
      createdAt: typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : 0,
    });
    if (out.length >= MAX_CUSTOM_VARIANTS) break;
  }
  return out;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

const KNOWN_EARNED = new Set<string>([...ENDGAME_FEATURE_IDS, ...CUSTOM_SLOT_IDS]);

/** Dev Mode is stored with the main save, which is available before the roster is built. */
function devModeForgeAccess(): boolean {
  try {
    const raw = storage()?.getItem('survivor616.meta.v1');
    if (!raw) return false;
    const meta = JSON.parse(raw) as { devModeAccessUnlocked?: unknown; devModeAllUnlocks?: unknown };
    return meta.devModeAccessUnlocked === true && meta.devModeAllUnlocks === true;
  } catch {
    return false;
  }
}

function normalizeForgeState(input: unknown): ForgeState | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const parsed = input as { unlocked?: unknown; operators?: unknown; earned?: unknown; toggles?: unknown; customEnemies?: unknown; customPets?: unknown; runUse?: unknown; hideoutDock?: unknown; stats?: unknown };
  try {
    const seen = new Set<string>();
    const operators: ForgedOperator[] = [];
    if (Array.isArray(parsed.operators)) {
      for (const item of parsed.operators) {
        const op = normalizeForgedOperator(item);
        if (!op || seen.has(op.id)) continue;
        seen.add(op.id);
        operators.push(op);
        if (operators.length >= MAX_FORGED_OPERATORS) break;
      }
    }
    const earned = Array.isArray(parsed.earned)
      ? [...new Set(parsed.earned.filter((id): id is string => typeof id === 'string' && KNOWN_EARNED.has(id)))]
      : [];
    const toggles: ForgeState['toggles'] = {};
    if (parsed.toggles && typeof parsed.toggles === 'object') {
      for (const id of ENDGAME_FEATURE_IDS) {
        const value = (parsed.toggles as Record<string, unknown>)[id];
        if (typeof value === 'boolean') toggles[id] = value;
      }
    }
    return { unlocked: parsed.unlocked === true, operators, earned, toggles, customEnemies: normalizeVariants(parsed.customEnemies), customPets: normalizeVariants(parsed.customPets), runUse: normalizeRunUse(parsed.runUse), hideoutDock: parsed.hideoutDock !== false, stats: normalizeStats(parsed.stats) };
  } catch {
    return null;
  }
}

function read(): ForgeState {
  const empty: ForgeState = { unlocked: false, operators: [], earned: [], toggles: {}, customEnemies: [], customPets: [], runUse: EMPTY_RUN_USE, hideoutDock: true, stats: EMPTY_STATS };
  const store = storage();
  if (!store) return empty;
  try {
    const raw = store.getItem(FORGE_STORAGE_KEY);
    return raw ? normalizeForgeState(JSON.parse(raw)) ?? empty : empty;
  } catch {
    return empty;
  }
}

function write(state: ForgeState): boolean {
  const store = storage();
  if (!store) return false;
  activeCache = null;
  try {
    store.setItem(FORGE_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** Validated snapshot for a portable progress archive. */
export function exportForgeState(): ForgeState {
  return read();
}

/** Replaces device-local Forge data after an archive has been validated. */
export function importForgeState(input: unknown): boolean {
  const state = normalizeForgeState(input);
  return state ? write(state) : false;
}

export function isValidForgeState(input: unknown): boolean {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const raw = input as Record<string, unknown>;
  if (typeof raw.unlocked !== 'boolean' || !Array.isArray(raw.operators) || !Array.isArray(raw.earned) || !raw.toggles || typeof raw.toggles !== 'object' || Array.isArray(raw.toggles)) return false;
  const normalized = normalizeForgeState(input);
  return normalized !== null && normalized.operators.length === raw.operators.length;
}

/* ------------------------------------------------------------------ */
/* End-game unlocks and toggles                                        */

/** Records unlocks the save has earned. Earning is permanent. Returns the ids that were new. */
export function recordEarnedEndgame(ids: string[]): string[] {
  const state = read();
  const fresh = ids.filter((id) => KNOWN_EARNED.has(id) && !state.earned.includes(id));
  if (fresh.length > 0) write({ ...state, earned: [...state.earned, ...fresh] });
  return fresh;
}

export function earnedEndgameIds(): string[] {
  return read().earned;
}

/** How many custom slots have been earned. */
export function earnedSlotCount(): number {
  if (devModeForgeAccess()) return CUSTOM_SLOT_IDS.length;
  const earned = read().earned;
  return CUSTOM_SLOT_IDS.filter((id) => earned.includes(id)).length;
}

/** Whether a feature has been earned (or, for the Forge, was already found before it became an unlock). */
export function isFeatureAvailable(id: EndgameFeatureId): boolean {
  if (id === 'forge' && devModeForgeAccess()) return true;
  const state = read();
  if (state.earned.includes(id)) return true;
  return id === 'forge' && state.unlocked;
}

/** Whether the player has it switched on. Endgame weapon evolutions default to on when earned. */
export function isFeatureEnabled(id: EndgameFeatureId): boolean {
  if (id === 'forge' && devModeForgeAccess()) return true;
  const state = read();
  const available = state.earned.includes(id) || (id === 'forge' && state.unlocked);
  if (!available) return false;
  const choice = state.toggles[id];
  if (typeof choice === 'boolean') return choice;
  return (id === 'forge' && state.unlocked) || id === 'weaponEvolutions';
}

export function setFeatureEnabled(id: EndgameFeatureId, enabled: boolean): void {
  const state = read();
  write({ ...state, toggles: { ...state.toggles, [id]: enabled } });
}

/** True when the Forge is both available and switched on. */
export function isForgeUnlocked(): boolean {
  return isFeatureEnabled('forge');
}

export function loadForgedOperators(): ForgedOperator[] {
  return read().operators;
}

/** Forged operators appear on the roster only while the Forge is switched on. */
export function loadRosterForgedOperators(): ForgedOperator[] {
  if (!isFeatureEnabled('forge')) return [];
  const state = read();
  return state.operators.filter((op) => isRunUseOn(state.runUse, 'operators', op.id));
}

/** How many more operators can be kept: earned slots minus operators already saved (never below 0). */
export function freeSlotCount(): number {
  const state = read();
  const slots = earnedSlotCount();
  return Math.max(0, slots - state.operators.length);
}

/** Adds an operator into a free slot or replaces the one with the same id. Returns false when no slot is free or storage is unavailable. */
export function saveForgedOperator(op: ForgedOperator): boolean {
  const state = read();
  const existing = state.operators.findIndex((o) => o.id === op.id);
  const operators = [...state.operators];
  if (existing >= 0) operators[existing] = op;
  else {
    const slots = earnedSlotCount();
    if (operators.length >= slots || operators.length >= MAX_FORGED_OPERATORS) return false;
    operators.push(op);
  }
  return write({ ...state, unlocked: state.unlocked, operators });
}

export function deleteForgedOperator(id: string): void {
  const state = read();
  write({ ...state, operators: state.operators.filter((o) => o.id !== id) });
}

/* ------------------------------------------------------------------ */
/* Classic enemy and LokPet recolors                                   */

const variantKey = (kind: CustomVariantKind) => (kind === 'enemy' ? 'customEnemies' : 'customPets') as 'customEnemies' | 'customPets';

export function loadCustomVariants(kind: CustomVariantKind): CustomVariant[] {
  return read()[variantKey(kind)];
}

/** Adds or replaces (same id) a recolor. Returns false when full or storage is unavailable. */
export function saveCustomVariant(kind: CustomVariantKind, variant: CustomVariant): boolean {
  const state = read();
  const key = variantKey(kind);
  const list = [...state[key]];
  const at = list.findIndex((v) => v.id === variant.id);
  if (at >= 0) list[at] = variant;
  else if (list.length >= MAX_CUSTOM_VARIANTS) return false;
  else list.push(variant);
  return write({ ...state, [key]: list });
}

export function deleteCustomVariant(kind: CustomVariantKind, id: string): void {
  const state = read();
  const key = variantKey(kind);
  write({ ...state, [key]: state[key].filter((v) => v.id !== id) });
}

/* ------------------------------------------------------------------ */
/* Per-item and master "use in runs" switches                          */

type RunUseGroup = 'operators' | 'enemies' | 'pets';

function isRunUseOn(runUse: RunUse, group: RunUseGroup, id: string): boolean {
  return runUse.master && runUse[group][id] !== false;
}

export function getRunUse(): RunUse {
  return read().runUse;
}

/** True when the master switch and the item's own switch are both on. */
export function isCustomActive(group: RunUseGroup, id: string): boolean {
  return isRunUseOn(read().runUse, group, id);
}

export function setCustomActive(group: RunUseGroup, id: string, on: boolean): void {
  const state = read();
  write({ ...state, runUse: { ...state.runUse, [group]: { ...state.runUse[group], [id]: on } } });
}

export function setCustomMaster(on: boolean): void {
  const state = read();
  write({ ...state, runUse: { ...state.runUse, master: on } });
}

/** Sets every saved custom (operators, enemy looks, pet looks) on or off in one go. */
export function setAllCustomsActive(on: boolean): void {
  const state = read();
  const flags = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, on]));
  write({
    ...state,
    runUse: {
      master: on ? true : state.runUse.master,
      operators: flags(state.operators.map((o) => o.id)),
      enemies: flags(state.customEnemies.map((v) => v.id)),
      pets: flags(state.customPets.map((v) => v.id)),
    },
  });
}

export function isHideoutDockEnabled(): boolean {
  return read().hideoutDock;
}

export function setHideoutDockEnabled(on: boolean): void {
  write({ ...read(), hideoutDock: on });
}

/* Palette overrides read by the renderer. Cached until the next write. */

let activeCache: { enemies: Map<string, SpritePalette>; pets: Map<string, SpritePalette> } | null = null;

function activePalettes() {
  if (activeCache) return activeCache;
  const state = read();
  const pick = (list: CustomVariant[], group: 'enemies' | 'pets') => {
    const map = new Map<string, SpritePalette>();
    // First active look for a base wins.
    for (const v of list) if (!map.has(v.baseId) && isRunUseOn(state.runUse, group, v.id)) map.set(v.baseId, v.palette);
    return map;
  };
  activeCache = { enemies: pick(state.customEnemies, 'enemies'), pets: pick(state.customPets, 'pets') };
  return activeCache;
}

/** The active custom palette for an enemy id, if the player has one switched on for runs. */
export function customEnemyPalette(enemyId: string): SpritePalette | undefined {
  return activePalettes().enemies.get(enemyId);
}

export function customPetPalette(variantId: string): SpritePalette | undefined {
  return activePalettes().pets.get(variantId);
}

/* ------------------------------------------------------------------ */
/* Achievement counters                                                */

export function getForgeStats(): ForgeStats {
  return read().stats;
}

export function bumpForgeStat(stat: 'shareCodes' | 'classicSaved' | 'detailedSaved' | 'recolored'): void {
  const state = read();
  write({ ...state, stats: { ...state.stats, [stat]: state.stats[stat] + 1 } });
}

export function recordForgeTab(tab: string): void {
  const state = read();
  if (state.stats.tabsVisited.includes(tab)) return;
  write({ ...state, stats: { ...state.stats, tabsVisited: [...state.stats.tabsVisited, tab] } });
}
