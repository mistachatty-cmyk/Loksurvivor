/**
 * Strike a Pose: the seventh Lok Party mode. A pose card flashes and everyone races to strike it: tap
 * the matching tile (or push the stick that way). First right is +3, second +2, third +1; a wrong pose
 * costs a point and locks you out for a beat. Some rounds are worth double, and one round hides the
 * card after a blink so you have to remember it.
 *
 * Pure and seeded: no DOM. World units: origin at the centre of the four-tile cross.
 */

import { createRng } from '@/game/engine/math';
import type { MinigameResult, MinigameSeat, StageInput } from './minigameKit';

export const POSE = {
  rounds: 8,
  readyMs: 600,
  windowMs: 2600,
  revealMs: 900,
  roundMs: 4100,
  lockoutMs: 500,
  /** Tile centres sit this far from the cross centre; tiles are 100 wide. */
  spacing: 108,
  tile: 50,
  /** In a memory round the card is only visible for this long. */
  blinkMs: 700,
} as const;

/** Poses in tile order: up, left, right, down. */
export type PoseId = 0 | 1 | 2 | 3;
export const POSE_NAMES = ['hero', 'flex', 'star', 'crouch'] as const;
export const TILE_CENTERS: { x: number; y: number }[] = [
  { x: 0, y: -POSE.spacing },
  { x: -POSE.spacing, y: 0 },
  { x: POSE.spacing, y: 0 },
  { x: 0, y: POSE.spacing },
];

export type RoundKind = 'normal' | 'double' | 'memory';

export interface PoseRunner {
  index: number;
  characterId: string;
  bot: boolean;
  skill: number;
  score: number;
  /** This round: -1 none yet, else the pose picked. */
  pick: number;
  pickAt: number;
  rankThisRound: number;
  lockedUntil: number;
  /** Where the stick was last step, for edge detection. */
  prevDir: number;
  /** The time a bot will answer this round, and what it will pick. */
  botAt: number;
  botPick: number;
  totalReactMs: number;
  rights: number;
  streak: number;
}

export type PoseEvent =
  | { type: 'show'; round: number; kind: RoundKind }
  | { type: 'right'; index: number; rank: number; points: number; streak: number }
  | { type: 'wrong'; index: number }
  | { type: 'reveal'; round: number }
  | { type: 'hide' };

export interface PoseState {
  seed: number;
  rng: () => number;
  now: number;
  durationMs: number;
  over: boolean;
  runners: PoseRunner[];
  poses: PoseId[];
  kinds: RoundKind[];
  round: number;
  roundStart: number;
  /** Next rank to hand out this round. */
  nextRank: number;
  revealed: boolean;
  events: PoseEvent[];
}

export function createStrikePose(seed: number, seats: MinigameSeat[]): PoseState {
  const rng = createRng(seed);
  const poses: PoseId[] = [];
  const kinds: RoundKind[] = [];
  for (let i = 0; i < POSE.rounds; i++) {
    let p = Math.floor(rng() * 4) as PoseId;
    if (i > 0 && p === poses[i - 1]) p = ((p + 1 + Math.floor(rng() * 3)) % 4) as PoseId;
    poses.push(p);
    kinds.push(i === 3 || i === 7 ? 'double' : i === 5 ? 'memory' : 'normal');
  }
  const runners = seats.map(
    (seat, index): PoseRunner => ({
      index,
      characterId: seat.characterId,
      bot: seat.bot,
      skill: seat.botSkill ?? 0.5,
      score: 0,
      pick: -1,
      pickAt: 0,
      rankThisRound: 0,
      lockedUntil: 0,
      prevDir: -1,
      botAt: 0,
      botPick: 0,
      totalReactMs: 0,
      rights: 0,
      streak: 0,
    }),
  );
  const s: PoseState = { seed, rng, now: 0, durationMs: POSE.rounds * POSE.roundMs, over: false, runners, poses, kinds, round: 0, roundStart: 0, nextRank: 1, revealed: false, events: [] };
  beginRound(s, 0);
  return s;
}

function beginRound(s: PoseState, round: number) {
  s.round = round;
  s.roundStart = round * POSE.roundMs;
  s.nextRank = 1;
  s.revealed = false;
  for (const r of s.runners) {
    r.pick = -1;
    r.rankThisRound = 0;
    if (r.bot) {
      const react = 520 + (1 - r.skill) * 1100 + s.rng() * 380;
      r.botAt = POSE.readyMs + react;
      const wrong = s.rng() < (1 - r.skill) * 0.28;
      r.botPick = wrong ? (((s.poses[round] + 1 + Math.floor(s.rng() * 3)) % 4) as number) : s.poses[round];
    }
  }
  s.events.push({ type: 'show', round, kind: s.kinds[round] });
}

export const roundPhase = (s: PoseState): 'ready' | 'go' | 'reveal' => {
  const t = s.now - s.roundStart;
  return t < POSE.readyMs ? 'ready' : t < POSE.readyMs + POSE.windowMs ? 'go' : 'reveal';
};

/** Whether the card is on screen right now (memory rounds hide it after a blink). */
export const cardVisible = (s: PoseState): boolean => {
  if (s.kinds[s.round] !== 'memory') return true;
  const t = s.now - s.roundStart;
  return t < POSE.readyMs + POSE.blinkMs || roundPhase(s) === 'reveal';
};

export const roundValue = (s: PoseState) => (s.kinds[s.round] === 'double' ? 2 : 1);

/** A stick or arrow direction as a pose index, or -1. */
export function dirToPose(x: number, y: number): number {
  if (Math.hypot(x, y) < 0.6) return -1;
  if (Math.abs(x) > Math.abs(y)) return x < 0 ? 1 : 2;
  return y < 0 ? 0 : 3;
}

/** The tile a world point falls on, or -1. */
export function tileAt(x: number, y: number): number {
  for (let i = 0; i < 4; i++) {
    const c = TILE_CENTERS[i];
    if (Math.abs(x - c.x) <= POSE.tile && Math.abs(y - c.y) <= POSE.tile) return i;
  }
  return -1;
}

function answer(s: PoseState, r: PoseRunner, pose: number) {
  if (roundPhase(s) !== 'go' || r.pick >= 0 || s.now < r.lockedUntil) return;
  if (pose === s.poses[s.round]) {
    r.pick = pose;
    r.pickAt = s.now;
    r.rankThisRound = s.nextRank++;
    const base = r.rankThisRound === 1 ? 3 : r.rankThisRound === 2 ? 2 : 1;
    const points = base * roundValue(s);
    r.score += points;
    r.rights += 1;
    r.streak += 1;
    r.totalReactMs += s.now - s.roundStart - POSE.readyMs;
    s.events.push({ type: 'right', index: r.index, rank: r.rankThisRound, points, streak: r.streak });
  } else {
    r.score = Math.max(0, r.score - 1);
    r.lockedUntil = s.now + POSE.lockoutMs;
    r.streak = 0;
    s.events.push({ type: 'wrong', index: r.index });
  }
}

export function stepStrikePose(s: PoseState, inputs: (StageInput | null)[], dtMs: number): void {
  s.events = [];
  if (s.over) return;
  s.now += dtMs;

  const phase = roundPhase(s);
  for (const r of s.runners) {
    if (r.bot) {
      if (phase === 'go' && r.pick < 0 && s.now - s.roundStart >= r.botAt) answer(s, r, r.botPick);
      continue;
    }
    const input = inputs[r.index] ?? null;
    if (!input) continue;
    const dir = dirToPose(input.keys.x, input.keys.y);
    if (dir >= 0 && dir !== r.prevDir) answer(s, r, dir);
    r.prevDir = dir;
    if (input.tap) {
      const t = tileAt(input.tap.x, input.tap.y);
      if (t >= 0) answer(s, r, t);
    }
  }

  if (phase === 'reveal' && !s.revealed) {
    s.revealed = true;
    for (const r of s.runners) if (r.pick < 0) r.streak = 0;
    s.events.push({ type: 'reveal', round: s.round });
  }
  if (s.kinds[s.round] === 'memory' && phase === 'go' && s.now - s.roundStart >= POSE.readyMs + POSE.blinkMs && s.now - s.roundStart < POSE.readyMs + POSE.blinkMs + 40) {
    s.events.push({ type: 'hide' });
  }

  if (s.now - s.roundStart >= POSE.roundMs) {
    if (s.round + 1 >= POSE.rounds) s.over = true;
    else beginRound(s, s.round + 1);
  }
}

export function poseResults(s: PoseState): MinigameResult[] {
  return [...s.runners]
    .sort((a, b) => b.score - a.score || a.totalReactMs / Math.max(1, a.rights) - b.totalReactMs / Math.max(1, b.rights) || a.index - b.index)
    .map((r, i) => ({ index: r.index, characterId: r.characterId, placement: i + 1, banked: r.score }));
}
