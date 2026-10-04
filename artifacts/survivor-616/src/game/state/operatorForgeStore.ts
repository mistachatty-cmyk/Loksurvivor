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
  MAX_FORGED_OPERATORS, normalizeForgedOperator, type ForgedOperator,
} from '@/game/data/operatorForge';
import { CUSTOM_SLOT_IDS, ENDGAME_FEATURE_IDS, type EndgameFeatureId } from '@/game/data/endgameUnlocks';

export const FORGE_STORAGE_KEY = 'survivor616.forge.v1';

/**
 * `unlocked` is the legacy "found the hidden workshop" flag from before the
 * Forge became an end-game unlock. It is still honored so nobody who already
 * had the Forge loses it. New access comes from `earned`.
 */
interface ForgeState {
  unlocked: boolean;
  operators: ForgedOperator[];
  /** Sticky end-game unlock ids (features and custom slots). */
  earned: string[];
  /** Explicit on/off choices; a missing key means "use the default". */
  toggles: Partial<Record<EndgameFeatureId, boolean>>;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

const KNOWN_EARNED = new Set<string>([...ENDGAME_FEATURE_IDS, ...CUSTOM_SLOT_IDS]);

function read(): ForgeState {
  const empty: ForgeState = { unlocked: false, operators: [], earned: [], toggles: {} };
  const store = storage();
  if (!store) return empty;
  try {
    const raw = store.getItem(FORGE_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as { unlocked?: unknown; operators?: unknown; earned?: unknown; toggles?: unknown };
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
    return { unlocked: parsed.unlocked === true, operators, earned, toggles };
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
  const earned = read().earned;
  return CUSTOM_SLOT_IDS.filter((id) => earned.includes(id)).length;
}

/** Whether a feature has been earned (or, for the Forge, was already found before it became an unlock). */
export function isFeatureAvailable(id: EndgameFeatureId): boolean {
  const state = read();
  if (state.earned.includes(id)) return true;
  return id === 'forge' && state.unlocked;
}

/** Whether the player has it switched on. Earned features default to off, except a Forge found before this change. */
export function isFeatureEnabled(id: EndgameFeatureId): boolean {
  const state = read();
  const available = state.earned.includes(id) || (id === 'forge' && state.unlocked);
  if (!available) return false;
  const choice = state.toggles[id];
  if (typeof choice === 'boolean') return choice;
  return id === 'forge' && state.unlocked;
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
  const slots = CUSTOM_SLOT_IDS.filter((id) => state.earned.includes(id)).length;
  return Math.max(0, slots - state.operators.length);
}

/** Adds an operator into a free slot or replaces the one with the same id. Returns false when no slot is free or storage is unavailable. */
export function saveForgedOperator(op: ForgedOperator): boolean {
  const state = read();
  const existing = state.operators.findIndex((o) => o.id === op.id);
  const operators = [...state.operators];
  if (existing >= 0) operators[existing] = op;
  else {
    const slots = CUSTOM_SLOT_IDS.filter((id) => state.earned.includes(id)).length;
    if (operators.length >= slots || operators.length >= MAX_FORGED_OPERATORS) return false;
    operators.push(op);
  }
  return write({ ...state, unlocked: state.unlocked, operators });
}

export function deleteForgedOperator(id: string): void {
  const state = read();
  write({ ...state, operators: state.operators.filter((o) => o.id !== id) });
}
