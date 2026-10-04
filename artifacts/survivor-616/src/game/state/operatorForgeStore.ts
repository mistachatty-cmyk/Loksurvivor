/**
 * Device-local storage for the Operator Forge: whether the hidden customizer
 * has been revealed, and the operators the player has forged.
 *
 * This is a plain module (no React) because the roster is built when
 * `data/characters.ts` loads, long before any component renders. Every
 * read tolerates a missing `localStorage` (tests, private windows) and
 * corrupt data, and never throws.
 */
import {
  MAX_FORGED_OPERATORS, normalizeForgedOperator, type ForgedOperator,
} from '@/game/data/operatorForge';

export const FORGE_STORAGE_KEY = 'survivor616.forge.v1';

interface ForgeState {
  unlocked: boolean;
  operators: ForgedOperator[];
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function read(): ForgeState {
  const empty: ForgeState = { unlocked: false, operators: [] };
  const store = storage();
  if (!store) return empty;
  try {
    const raw = store.getItem(FORGE_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as { unlocked?: unknown; operators?: unknown };
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
    return { unlocked: parsed.unlocked === true || operators.length > 0, operators };
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

/** True once the player has found the hidden customizer (or already forged something). */
export function isForgeUnlocked(): boolean {
  return read().unlocked;
}

export function unlockForge(): void {
  const state = read();
  if (!state.unlocked) write({ ...state, unlocked: true });
}

export function loadForgedOperators(): ForgedOperator[] {
  return read().operators;
}

/** Adds a new operator or replaces the one with the same id. Returns false when storage is unavailable or full. */
export function saveForgedOperator(op: ForgedOperator): boolean {
  const state = read();
  const existing = state.operators.findIndex((o) => o.id === op.id);
  const operators = [...state.operators];
  if (existing >= 0) operators[existing] = op;
  else if (operators.length >= MAX_FORGED_OPERATORS) return false;
  else operators.push(op);
  return write({ unlocked: true, operators });
}

export function deleteForgedOperator(id: string): void {
  const state = read();
  write({ ...state, operators: state.operators.filter((o) => o.id !== id) });
}
