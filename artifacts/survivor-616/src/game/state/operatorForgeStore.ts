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
  const parsed = input as { unlocked?: unknown; operators?: unknown; earned?: unknown; toggles?: unknown; customEnemies?: unknown; customPets?: unknown };
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
    return { unlocked: parsed.unlocked === true, operators, earned, toggles, customEnemies: normalizeVariants(parsed.customEnemies), customPets: normalizeVariants(parsed.customPets) };
  } catch {
    return null;
  }
}

function read(): ForgeState {
  const empty: ForgeState = { unlocked: false, operators: [], earned: [], toggles: {}, customEnemies: [], customPets: [] };
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
  return isFeatureEnabled('forge') ? read().operators : [];
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
