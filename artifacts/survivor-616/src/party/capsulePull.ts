/**
 * capsulePull.ts -- the tactile Gold L capsule crack (Lok Party Slice 2).
 *
 * Pure state machine so the feel is testable and identical on every screen that opens a capsule.
 * The player cracks the capsule by tapping, swiping across the seam, or holding. Each input adds
 * "crack" (0..1); crack leaks back slowly if the player stops, so it always feels physical.
 * At full crack the capsule bursts and the rewards are revealed one at a time.
 *
 * Phases: idle -> cracking -> burst -> reveal (one per reward) -> done.
 */

export type PullPhase = 'idle' | 'cracking' | 'burst' | 'reveal' | 'done';

export const PULL = {
  tapCrack: 0.26,
  /** Crack per screen pixel swiped across the seam. */
  swipeCrackPerPx: 0.0035,
  holdCrackPerSec: 0.55,
  leakPerSec: 0.18,
  /** No leak for this long after an input. */
  leakDelayMs: 450,
  burstMs: 650,
  revealMinMs: 420,
  /** Crack thresholds where the seam visibly opens a stage (for sound and shake). */
  stages: [0.33, 0.66] as const,
} as const;

export interface PullState {
  phase: PullPhase;
  crack: number;
  stage: number;
  lastInputAt: number;
  holding: boolean;
  burstAt: number;
  revealIndex: number;
  revealAt: number;
  rewardCount: number;
}

export type PullEvent = { kind: 'stage'; stage: number } | { kind: 'burst' } | { kind: 'reveal'; index: number } | { kind: 'done' };

export function createPull(rewardCount: number): PullState {
  return { phase: 'idle', crack: 0, stage: 0, lastInputAt: -Infinity, holding: false, burstAt: 0, revealIndex: -1, revealAt: 0, rewardCount: Math.max(1, rewardCount) };
}

function addCrack(s: PullState, amount: number, now: number): PullEvent[] {
  if (s.phase !== 'idle' && s.phase !== 'cracking') return [];
  s.phase = 'cracking';
  s.crack = Math.min(1, s.crack + Math.max(0, amount));
  s.lastInputAt = now;
  return settle(s, now);
}

function settle(s: PullState, now: number): PullEvent[] {
  const out: PullEvent[] = [];
  let stage = 0;
  for (const t of PULL.stages) if (s.crack >= t) stage += 1;
  if (stage > s.stage) {
    s.stage = stage;
    out.push({ kind: 'stage', stage });
  }
  if (s.crack >= 1 && s.phase === 'cracking') {
    s.phase = 'burst';
    s.burstAt = now;
    out.push({ kind: 'burst' });
  }
  return out;
}

export function pullTap(s: PullState, now: number): PullEvent[] {
  if (s.phase === 'reveal') return advanceReveal(s, now);
  return addCrack(s, PULL.tapCrack, now);
}

export function pullSwipe(s: PullState, px: number, now: number): PullEvent[] {
  return addCrack(s, Math.abs(px) * PULL.swipeCrackPerPx, now);
}

export function pullHold(s: PullState, holding: boolean, now: number): void {
  s.holding = holding;
  if (holding) s.lastInputAt = now;
}

/** Advance time. Returns events (burst finishing into the first reveal, etc.). */
export function pullStep(s: PullState, dtMs: number, now: number): PullEvent[] {
  const dt = dtMs / 1000;
  if (s.phase === 'idle' || s.phase === 'cracking') {
    if (s.holding) return addCrack(s, PULL.holdCrackPerSec * dt, now);
    if (s.phase === 'cracking' && now - s.lastInputAt > PULL.leakDelayMs) {
      s.crack = Math.max(0, s.crack - PULL.leakPerSec * dt);
      // Leaking never takes back a stage already shown; it only slows the finish.
    }
    return [];
  }
  if (s.phase === 'burst' && now - s.burstAt >= PULL.burstMs) {
    s.phase = 'reveal';
    s.revealIndex = 0;
    s.revealAt = now;
    return [{ kind: 'reveal', index: 0 }];
  }
  return [];
}

function advanceReveal(s: PullState, now: number): PullEvent[] {
  if (now - s.revealAt < PULL.revealMinMs) return [];
  if (s.revealIndex + 1 < s.rewardCount) {
    s.revealIndex += 1;
    s.revealAt = now;
    return [{ kind: 'reveal', index: s.revealIndex }];
  }
  s.phase = 'done';
  return [{ kind: 'done' }];
}

/** Seam glow 0..1 for drawing: crack plus a pulse while held. */
export function seamGlow(s: PullState, now: number): number {
  if (s.phase === 'burst' || s.phase === 'reveal' || s.phase === 'done') return 1;
  const pulse = s.holding ? 0.12 * (0.5 + 0.5 * Math.sin(now / 50)) : 0;
  return Math.min(1, s.crack + pulse);
}
