/**
 * The wall-jump loading game's rules, apart from the drawing so they can be tested. Positions are in the
 * shaft's own space: x runs from the left wall (0) to the right wall (`gap`), y grows downward and the climb
 * goes to negative y. The renderer places the shaft on screen.
 */

export interface Hazard {
  y: number;
  side: 'left' | 'right';
  kind: 'sign' | 'vent';
  depth: number;
  h: number;
}

export interface ClimbState {
  seed: number;
  gap: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** The wall the climber is holding, or null in the air. */
  clinging: 'left' | 'right' | null;
  facing: 1 | -1;
  /** The camera's y: it follows the climber up, never down. */
  camY: number;
  /** Highest point reached (most negative y). */
  bestY: number;
  /** A leap pressed just before landing still counts for a moment. */
  buffer: number;
}

export const BODY_HALF = 9;
export const BODY_HEIGHT = 34;
const GRAVITY = 1000;
const LEAP_VY = 440;
const LEAP_VX = 330;
const BUFFER_S = 0.12;
const ROW = 150;
/** The first few rows are clear so a new climber can find the rhythm. */
const SAFE_ROWS = 4;
/** Falling this far below the camera ends the climb. */
export const FALL_MARGIN = 300;

export function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function newClimbRun(): number {
  return Math.floor(Math.random() * 100000) + 1;
}

export function createClimb(seed: number, gap: number): ClimbState {
  return { seed, gap, x: BODY_HALF, y: 0, vx: 0, vy: 0, clinging: 'left', facing: 1, camY: 0, bestY: 0, buffer: 0 };
}

/** The sign or vent in a row, if there is one. Always the same for the same seed. */
export function hazardInRow(seed: number, row: number): Hazard | null {
  if (row < SAFE_ROWS) return null;
  const chance = Math.min(0.75, 0.3 + row * 0.01);
  if (hash(seed * 13.7 + row * 1.9) > chance) return null;
  const side = hash(seed * 5.3 + row * 7.1) < 0.5 ? 'left' : 'right';
  const h = 26 + Math.round(hash(seed + row * 3.3) * 10);
  return {
    y: -row * ROW + Math.round((hash(seed * 2.1 + row) - 0.5) * 50),
    side,
    kind: hash(seed * 9.1 + row * 4.4) < 0.55 ? 'sign' : 'vent',
    depth: 30 + Math.round(hash(seed + row * 8.8) * 12),
    h,
  };
}

/** Every hazard near the camera. */
export function hazardsAround(state: ClimbState): Hazard[] {
  const top = Math.floor((-state.camY - 900) / ROW);
  const bottom = Math.ceil((-state.camY + 500) / ROW);
  const out: Hazard[] = [];
  for (let row = Math.max(SAFE_ROWS, top); row <= bottom; row += 1) {
    const hazard = hazardInRow(state.seed, row);
    if (hazard) out.push(hazard);
  }
  return out;
}

function hitsHazard(state: ClimbState): boolean {
  for (const hazard of hazardsAround(state)) {
    const x0 = hazard.side === 'left' ? 0 : state.gap - hazard.depth;
    const x1 = x0 + hazard.depth;
    if (state.x + BODY_HALF > x0 && state.x - BODY_HALF < x1 && state.y > hazard.y && state.y - BODY_HEIGHT < hazard.y + hazard.h) return true;
  }
  return false;
}

/** How fast the climber slides down a wall; it picks up as you climb. */
export function slideSpeed(state: ClimbState): number {
  return 62 + Math.min(70, Math.max(0, -state.bestY) * 0.012);
}

/** Moves the climb on by `dt` seconds. `leap` is true when the player pressed leap since last time. */
export function advanceClimb(state: ClimbState, dt: number, leap: boolean): { fell: boolean } {
  if (leap) state.buffer = BUFFER_S; else state.buffer = Math.max(0, state.buffer - dt);

  if (state.clinging) {
    if (state.buffer > 0) {
      const toRight = state.clinging === 'left';
      state.clinging = null;
      state.vx = toRight ? LEAP_VX : -LEAP_VX;
      state.vy = -LEAP_VY;
      state.facing = toRight ? 1 : -1;
      state.buffer = 0;
    } else {
      state.vy = slideSpeed(state);
      state.y += state.vy * dt;
    }
  }
  if (!state.clinging) {
    state.vy += GRAVITY * dt;
    state.x += state.vx * dt;
    state.y += state.vy * dt;
    const rightStop = state.gap - BODY_HALF;
    if (state.x >= rightStop && state.vx > 0) { state.x = rightStop; state.clinging = 'right'; state.vx = 0; state.facing = -1; }
    else if (state.x <= BODY_HALF && state.vx < 0) { state.x = BODY_HALF; state.clinging = 'left'; state.vx = 0; state.facing = 1; }
  }

  if (state.y < state.bestY) state.bestY = state.y;
  if (state.y < state.camY) state.camY += (state.y - state.camY) * Math.min(1, dt * 9);
  const fell = state.y - state.camY > FALL_MARGIN || hitsHazard(state);
  return { fell };
}
