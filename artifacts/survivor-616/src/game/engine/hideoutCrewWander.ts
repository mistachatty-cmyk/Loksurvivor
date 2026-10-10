/**
 * Pure rules for the rare moment a static hideout NPC (rescued crew standing
 * in their room, or a cameo like the Frogster twins) steps away from its
 * usual spot, pauses as if looking at something nearby, then returns. No
 * canvas, no React, no clock -- callers pass `dt`/`now` (strip ms) and an
 * injected `rng`, same convention as `hideoutPets.ts`/`hideoutAmbient.ts`.
 *
 * Deliberately rare and one-at-a-time: a long, wide gap between wanders
 * (minutes, not seconds) and a single `activeId` slot, so the room never
 * reads as everyone pacing around at once -- that's the ask: an occasional,
 * uncommon flourish, not a constant simulation.
 */

export type CrewWanderPhase = 'out' | 'pause' | 'back';

export interface CrewWanderState {
  activeId: string | null;
  homeX: number;
  x: number;
  targetX: number;
  phase: CrewWanderPhase;
  /** Strip time the pause ends. */
  pauseUntil: number;
  /** Strip time the next wander is allowed to start. */
  nextAt: number;
}

/** Minutes-wide gap between wanders -- an uncommon flourish, not a loop. */
const WANDER_GAP_MS: readonly [number, number] = [150_000, 320_000];
const PAUSE_MS: readonly [number, number] = [1500, 3200];
const WANDER_RADIUS_PX = 70;
const WANDER_SPEED_PX_PER_MS = 0.045;
const ARRIVED_PX = 1.5;

const between = (span: readonly [number, number], roll: number): number => span[0] + (span[1] - span[0]) * roll;

export function createCrewWanderState(now: number, rng: () => number): CrewWanderState {
  return { activeId: null, homeX: 0, x: 0, targetX: 0, phase: 'out', pauseUntil: 0, nextAt: now + between(WANDER_GAP_MS, rng()) };
}

export interface CrewWanderInput {
  now: number;
  dt: number;
  /** Candidates this tick -- any prop currently drawn as an idle NPC. */
  eligible: ReadonlyArray<{ id: string; x: number }>;
  range: { min: number; max: number };
  rng: () => number;
}

/** Advances the wander by one frame. Mutates `state` in place. */
export function stepCrewWander(state: CrewWanderState, input: CrewWanderInput): void {
  const { now, dt, eligible, range, rng } = input;

  if (state.activeId === null) {
    if (now >= state.nextAt && eligible.length > 0) {
      const pick = eligible[Math.min(eligible.length - 1, Math.floor(rng() * eligible.length))]!;
      const radius = Math.min(WANDER_RADIUS_PX, (range.max - range.min) / 2);
      const dir = rng() < 0.5 ? -1 : 1;
      state.activeId = pick.id;
      state.homeX = pick.x;
      state.x = pick.x;
      state.targetX = Math.max(range.min, Math.min(range.max, pick.x + dir * (20 + rng() * radius)));
      state.phase = 'out';
    }
    return;
  }

  // The prop it's wandering from no longer exists this tick (room changed) -- snap off.
  if (!eligible.some((e) => e.id === state.activeId)) {
    state.activeId = null;
    state.nextAt = now + between(WANDER_GAP_MS, rng());
    return;
  }

  if (state.phase === 'pause') {
    if (now >= state.pauseUntil) {
      state.phase = 'back';
      state.targetX = state.homeX;
    }
    return;
  }

  const delta = state.targetX - state.x;
  const step = Math.max(-WANDER_SPEED_PX_PER_MS * dt, Math.min(WANDER_SPEED_PX_PER_MS * dt, delta));
  state.x += step;
  if (Math.abs(state.targetX - state.x) < ARRIVED_PX) {
    state.x = state.targetX;
    if (state.phase === 'out') {
      state.phase = 'pause';
      state.pauseUntil = now + between(PAUSE_MS, rng());
    } else {
      state.activeId = null;
      state.nextAt = now + between(WANDER_GAP_MS, rng());
    }
  }
}

/** Which way the wandering NPC should face; falls back to the usual "face the operator" look when not wandering. */
export function crewWanderFacing(state: CrewWanderState, fallback: 1 | -1): 1 | -1 {
  if (state.activeId === null || state.phase === 'pause') return fallback;
  const delta = state.targetX - state.x;
  return Math.abs(delta) < 0.5 ? fallback : delta > 0 ? 1 : -1;
}
