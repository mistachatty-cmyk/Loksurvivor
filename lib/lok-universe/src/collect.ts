// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
/**
 * Collect sequence plan, shared by every Lok game: a reward POPS out of its source, FLOATS for a beat, then each
 * piece FLIES into the wallet. The counter ticks up by an exact share on every landing, the wallet bumps, and a tiny
 * haptic fires. Pure and seeded (testable); drawing stays in each game so each keeps its own piece art.
 * Reduced motion and power save: fewer pieces, no float, or no show at all (the number is still right).
 * See docs/LOK_RETENTION_AND_JUICE_PLAYBOOK.md lesson 1 and docs/LOK_PARITY_AND_ECONOMY_PLAN.md step 3.
 */
import { seededRng } from "./runs";

export const POP_MS = 260;
export const HANG_MS = 620;
export const FLIGHT_MS = 780;
export const STAGGER_MS = 45;

export interface CollectPiece {
  /** Rest position during the float, relative to the source centre (px). */
  dx: number; dy: number;
  /** Total spin over the whole sequence (degrees). */
  spin: number;
  /** Stagger before this piece starts (ms). */
  delayMs: number;
  /** Slow bob during the float (px), so the pieces feel alive and not frozen. */
  bob: number;
  /** Share of the reward this piece adds to the counter when it lands. Shares always sum to the amount. */
  share: number;
}
export interface CollectPlan {
  pieces: CollectPiece[];
  popMs: number; hangMs: number; flightMs: number;
  /** Time until the last piece has landed. */
  totalMs: number;
  /** Haptic length in ms for each landing (0 for none). Games call navigator.vibrate only when allowed. */
  hapticMs: number;
}
export interface CollectOptions { amount: number; seed: number; powerSave?: boolean; reducedMotion?: boolean }

/** More reward, more pieces: 3 to 14, or 3 to 4 in power save. */
export function pieceCountFor(amount: number, powerSave = false): number {
  const a = Number.isFinite(amount) ? Math.max(1, amount) : 1;
  const n = Math.max(3, Math.min(14, 2 + Math.floor(Math.log2(a + 1))));
  return powerSave ? Math.min(4, n) : n;
}

/** Split `amount` into `parts` whole numbers that differ by at most one and sum exactly to `amount`. */
export function splitAmount(amount: number, parts: number): number[] {
  const total = Math.max(0, Math.floor(Number.isFinite(amount) ? amount : 0));
  const n = Math.max(1, Math.floor(parts));
  const base = Math.floor(total / n), extra = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

export function planCollect(o: CollectOptions): CollectPlan {
  const rng = seededRng(o.seed);
  const count = pieceCountFor(o.amount, o.powerSave);
  const shares = splitAmount(o.amount, count);
  const hang = o.reducedMotion ? 0 : o.powerSave ? 300 : HANG_MS;
  const pieces: CollectPiece[] = shares.map((share, i) => {
    const angle = -Math.PI / 2 + (rng() - 0.5) * Math.PI * 1.5; // mostly upward, like coins popping out
    const radius = 38 + rng() * 62;
    return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius, spin: 360 + Math.round(rng() * 360), delayMs: i * STAGGER_MS, bob: 3 + rng() * 5, share };
  });
  return {
    pieces, popMs: POP_MS, hangMs: hang, flightMs: FLIGHT_MS,
    totalMs: POP_MS + hang + FLIGHT_MS + (count - 1) * STAGGER_MS,
    hapticMs: o.reducedMotion || o.powerSave ? 0 : 8,
  };
}

/** The counter value after `landed` pieces have arrived. Never overshoots, and equals start + amount at the end. */
export function counterAfter(start: number, plan: CollectPlan, landed: number): number {
  let v = start;
  for (let i = 0; i < Math.min(landed, plan.pieces.length); i++) v += plan.pieces[i].share;
  return v;
}
