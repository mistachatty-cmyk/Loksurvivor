/**
 * Feel for the page overlay: the small, deterministic state machines behind hit flashes, cracks, dissolves,
 * debris, damage numbers, combos and hit-stop. Everything here is pure (no DOM, no canvas) and measured in
 * low-res CELLS, so it is unit-tested under node and `session.ts` only has to draw it.
 */
import { createRng } from '@/game/engine/math';

/* ---------------------------------------------------------------- cracks */

export type CrackStage = 0 | 1 | 2 | 3;

/** How broken a block looks, from its remaining HP share: intact above 66%, then 3 stages. */
export function crackStage(hpRatio: number): CrackStage {
  if (!(hpRatio < 1)) return 0;
  if (hpRatio > 0.66) return 0;
  if (hpRatio > 0.33) return 1;
  if (hpRatio > 0.15) return 2;
  return 3;
}

/**
 * Cells of the crack lines for a block of `w` x `h` cells (relative to its top-left). Seeded by the block, so a
 * block always cracks the same way, and each stage adds a line without moving the earlier ones.
 */
export function crackCells(seed: number, w: number, h: number, stage: CrackStage): Array<[number, number]> {
  if (stage === 0 || w < 3 || h < 3) return [];
  const rng = createRng(seed * 2654435761);
  const seen = new Set<number>();
  const cells: Array<[number, number]> = [];
  const add = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const key = y * w + x;
    if (seen.has(key)) return;
    seen.add(key);
    cells.push([x, y]);
  };
  for (let line = 0; line < stage; line += 1) {
    // start on a random edge, wander toward the middle
    const edge = Math.floor(rng() * 4);
    let x = edge === 0 ? 0 : edge === 1 ? w - 1 : Math.floor(rng() * w);
    let y = edge === 2 ? 0 : edge === 3 ? h - 1 : Math.floor(rng() * h);
    const length = Math.max(3, Math.round(Math.max(w, h) * (0.3 + 0.08 * line)));
    for (let step = 0; step < length; step += 1) {
      add(x, y);
      const dx = Math.sign(w / 2 - x) + (rng() < 0.4 ? Math.floor(rng() * 3) - 1 : 0);
      const dy = Math.sign(h / 2 - y) + (rng() < 0.4 ? Math.floor(rng() * 3) - 1 : 0);
      x += Math.max(-1, Math.min(1, dx));
      y += Math.max(-1, Math.min(1, dy));
    }
  }
  return cells;
}

/* -------------------------------------------------------------- dissolve */

export const DISSOLVE_STEP_MS = 60;
/** Bayer levels each dissolve step opens (16 = everything). */
export const DISSOLVE_LEVELS = [4, 8, 12, 16] as const;
/** The first frames after a break are a white flash with no hole yet. */
export const FLASH_MS = 50;

/** Bayer level a breaking block has reached `ageMs` after it broke (0 while it is still flashing). */
export function dissolveLevel(ageMs: number): number {
  if (ageMs < FLASH_MS) return 0;
  const step = Math.floor((ageMs - FLASH_MS) / DISSOLVE_STEP_MS);
  return DISSOLVE_LEVELS[Math.min(DISSOLVE_LEVELS.length - 1, step)]!;
}

export function dissolveDone(ageMs: number): boolean {
  return ageMs >= FLASH_MS + DISSOLVE_STEP_MS * (DISSOLVE_LEVELS.length - 1);
}

/* ----------------------------------------------------------- hit-stop */

export const HIT_STOP_MAX_MS = 60;
export const HIT_STOP_COOLDOWN_MS = 150;

/** A short freeze on a heavy break: bigger blocks and harder hits stop the world a little longer, never past 60 ms. */
export function hitStopMs(maxHp: number, intensity: number): number {
  if (maxHp < 40) return 0;
  return Math.min(HIT_STOP_MAX_MS, Math.round(16 + maxHp / 8 + Math.max(0, intensity) * 6));
}

/* ------------------------------------------------------------- combo */

export const COMBO_WINDOW_MS = 1200;
export const COMBO_MILESTONES = [10, 25, 50, 100, 200, 400] as const;

export interface ComboState {
  count: number;
  lastAt: number;
  best: number;
}

export function newCombo(): ComboState {
  return { count: 0, lastAt: -1e9, best: 0 };
}

/** Register a break at `nowMs`. Returns the milestone that was just crossed, if any. */
export function comboBreak(state: ComboState, nowMs: number): number | null {
  state.count = nowMs - state.lastAt <= COMBO_WINDOW_MS ? state.count + 1 : 1;
  state.lastAt = nowMs;
  state.best = Math.max(state.best, state.count);
  return COMBO_MILESTONES.find((m) => m === state.count) ?? null;
}

/** The count still on display at `nowMs` (0 once the window has lapsed). */
export function comboAlive(state: ComboState, nowMs: number): number {
  return nowMs - state.lastAt <= COMBO_WINDOW_MS ? state.count : 0;
}

/* ----------------------------------------------------- damage numbers */

export function damageNumberText(amount: number): string {
  const n = Math.max(0, Math.round(amount));
  if (n >= 10000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

export interface Floater {
  /** Block id this number belongs to, or -1 for free text. */
  key: number;
  /** Cells, in document space. */
  x: number;
  y: number;
  text: string;
  amount: number;
  bornAt: number;
  lastAddAt: number;
  kill: boolean;
}

export const FLOATER_MERGE_MS = 120;
export const FLOATER_LIFE_MS = 700;
const FLOATER_CAP = 40;

/** Hits on one block within 120 ms add up into one number instead of a stack of them. */
export function addFloater(list: Floater[], key: number, x: number, y: number, amount: number, kill: boolean, nowMs: number): void {
  const existing = key >= 0 ? list.find((f) => f.key === key && nowMs - f.bornAt <= FLOATER_MERGE_MS) : undefined;
  if (existing) {
    existing.amount += amount;
    existing.text = damageNumberText(existing.amount);
    existing.lastAddAt = nowMs;
    existing.kill = existing.kill || kill;
    return;
  }
  if (list.length >= FLOATER_CAP) list.shift();
  list.push({ key, x, y, text: damageNumberText(amount), amount, bornAt: nowMs, lastAddAt: nowMs, kill });
}

export function pruneFloaters(list: Floater[], nowMs: number): void {
  for (let i = list.length - 1; i >= 0; i -= 1) if (nowMs - list[i]!.bornAt > FLOATER_LIFE_MS) list.splice(i, 1);
}

/** Cells a floater has risen after `ageMs`. */
export function floaterRise(ageMs: number): number {
  return Math.floor((ageMs / 1000) * 14);
}

/* -------------------------------------------------------------- debris */

export interface Debris {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds left. */
  life: number;
  maxLife: number;
  size: 1 | 2;
  color: string;
}

export const DEBRIS_CAP = 420;

/** Pieces of a broken block, thrown away from the point it was hit. Cells and seconds. */
export function spawnDebris(
  out: Debris[],
  rng: () => number,
  rect: { x: number; y: number; w: number; h: number },
  from: { x: number; y: number },
  colors: readonly string[],
  count: number,
): void {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  for (let i = 0; i < count; i += 1) {
    if (out.length >= DEBRIS_CAP) out.shift();
    const x = rect.x + rng() * rect.w;
    const y = rect.y + rng() * rect.h;
    // away from the hit, with scatter
    let dx = x - from.x || cx - from.x || rng() - 0.5;
    let dy = y - from.y || cy - from.y || rng() - 0.5;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const speed = 18 + rng() * 48;
    const life = 0.35 + rng() * 0.45;
    out.push({
      x,
      y,
      vx: dx * speed + (rng() - 0.5) * 16,
      vy: dy * speed + (rng() - 0.5) * 16,
      life,
      maxLife: life,
      size: rng() < 0.3 ? 2 : 1,
      color: colors[Math.floor(rng() * colors.length)] ?? '#ffffff',
    });
  }
}

export function stepDebris(list: Debris[], dtSec: number): void {
  const drag = Math.pow(0.04, dtSec);
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const d = list[i]!;
    d.life -= dtSec;
    if (d.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    d.x += d.vx * dtSec;
    d.y += d.vy * dtSec;
    d.vx *= drag;
    d.vy *= drag;
  }
}
