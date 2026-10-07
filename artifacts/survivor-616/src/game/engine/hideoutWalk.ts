/**
 * Player control of the hideout operator. Pure: no canvas, no React, no clock
 * (callers pass `dt` and `now`, in ms of strip time), so every rule is testable.
 *
 * The operator still wanders on its own (`stepOperatorWalk` in `hideoutPets.ts`, which
 * this file never changes). A tap, a key press or a prop hands control to the player;
 * after `AUTO_RESUME_MS` of nothing it hands it back and the operator wanders again,
 * so the strip never looks frozen. With Walk and props switched off nothing here runs.
 */

import { stepOperatorWalk, type OperatorWalk } from '@/game/engine/hideoutPets';

export interface WalkRange { min: number; max: number }

/** A little brisker than the idle wander (0.045), so steering feels responsive. */
export const OPERATOR_MANUAL_SPEED = 0.06;

/** How long the operator stands where you left it before it goes back to wandering. */
export const AUTO_RESUME_MS = 8000;

export type ControlMode =
  /** The operator wanders by itself. */
  | 'auto'
  /** Walking to a tapped spot. */
  | 'goto'
  /** A direction key is held. */
  | 'keys'
  /** Arrived, or the key was released: standing still for a while. */
  | 'hold';

export interface OperatorControl {
  mode: ControlMode;
  goalX: number;
  /** Strip time at which a `hold` ends and wandering resumes. */
  holdUntil: number;
  /** Distance walked under the player's control, for the long-way-round beat. */
  strollPx: number;
}

export interface WalkInput { left: boolean; right: boolean }

export interface StepResult {
  /** True on the one step the operator reaches a tapped spot. */
  arrived: boolean;
  /** Pixels moved this step under the player's control. */
  moved: number;
}

export const createOperatorControl = (): OperatorControl => ({ mode: 'auto', goalX: 0, holdUntil: 0, strollPx: 0 });

const clamp = (x: number, range: WalkRange): number => Math.max(range.min, Math.min(range.max, x));

/** Walk to `x`. With `snap` (reduced motion) the operator is simply there. */
export function setGoal(op: OperatorWalk, ctl: OperatorControl, x: number, now: number, range: WalkRange, snap = false): void {
  const goal = clamp(x, range);
  ctl.goalX = goal;
  if (Math.abs(goal - op.x) > 0.5) op.dir = goal > op.x ? 1 : -1;
  if (snap) {
    ctl.strollPx += Math.abs(goal - op.x);
    op.x = goal;
    op.mode = 'rest';
    ctl.mode = 'goto';
    return;
  }
  ctl.mode = 'goto';
  op.mode = 'walk';
  op.until = now + 60_000;
}

/** One discrete step (used for reduced motion, where holding a key must not animate). */
export function nudgeOperator(op: OperatorWalk, ctl: OperatorControl, dir: 1 | -1, px: number, now: number, range: WalkRange): void {
  const before = op.x;
  op.x = clamp(op.x + dir * px, range);
  op.dir = dir;
  op.mode = 'rest';
  ctl.mode = 'hold';
  ctl.holdUntil = now + AUTO_RESUME_MS;
  ctl.strollPx += Math.abs(op.x - before);
}

export function stepOperatorControl(
  op: OperatorWalk,
  ctl: OperatorControl,
  input: WalkInput,
  dt: number,
  now: number,
  range: WalkRange,
  rng: () => number,
): StepResult {
  const dir = input.left === input.right ? 0 : input.right ? 1 : -1;

  if (dir !== 0) {
    const before = op.x;
    op.x = clamp(op.x + dir * OPERATOR_MANUAL_SPEED * dt, range);
    op.dir = dir;
    op.mode = 'walk';
    ctl.mode = 'keys';
    ctl.holdUntil = now + AUTO_RESUME_MS;
    const moved = Math.abs(op.x - before);
    ctl.strollPx += moved;
    return { arrived: false, moved };
  }

  if (input.left && input.right) {
    // Both held cancel out: stand still rather than letting the operator wander off.
    ctl.mode = 'hold';
    op.mode = 'rest';
    ctl.holdUntil = now + AUTO_RESUME_MS;
    return { arrived: false, moved: 0 };
  }

  if (ctl.mode === 'keys') {
    // Key released: stand still for a moment.
    ctl.mode = 'hold';
    op.mode = 'rest';
    ctl.holdUntil = now + AUTO_RESUME_MS;
  }

  if (ctl.mode === 'goto') {
    const delta = ctl.goalX - op.x;
    const step = OPERATOR_MANUAL_SPEED * dt;
    if (Math.abs(delta) <= step) {
      const moved = Math.abs(delta);
      op.x = ctl.goalX;
      op.mode = 'rest';
      ctl.mode = 'hold';
      ctl.holdUntil = now + AUTO_RESUME_MS;
      ctl.strollPx += moved;
      return { arrived: true, moved };
    }
    op.x += Math.sign(delta) * step;
    op.dir = delta > 0 ? 1 : -1;
    op.mode = 'walk';
    ctl.strollPx += step;
    return { arrived: false, moved: step };
  }

  if (ctl.mode === 'hold') {
    op.mode = 'rest';
    if (now >= ctl.holdUntil) {
      // Back to wandering: let the idle rules pick up from a rest that has already ended.
      ctl.mode = 'auto';
      op.until = now;
    } else {
      return { arrived: false, moved: 0 };
    }
  }

  stepOperatorWalk(op, dt, now, range, rng);
  return { arrived: false, moved: 0 };
}

/** The prop closest to the operator within `reachPx`, or null. */
export function nearestProp<T extends { x: number }>(operatorX: number, props: readonly T[], reachPx: number): T | null {
  let best: T | null = null;
  let bestGap = reachPx;
  for (const prop of props) {
    const gap = Math.abs(prop.x - operatorX);
    if (gap <= bestGap) {
      best = prop;
      bestGap = gap;
    }
  }
  return best;
}

/** Where to stand to use a prop at `propX`: beside it, on the side the operator is already on. */
export function standingSpot(operatorX: number, propX: number, offsetPx: number): number {
  return propX + (operatorX >= propX ? offsetPx : -offsetPx);
}
