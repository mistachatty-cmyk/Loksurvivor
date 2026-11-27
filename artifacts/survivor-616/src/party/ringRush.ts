/**
 * Ring Run Rush: the second Lok Party minigame (blueprint s5). A 30-second sprint down a neon street:
 * steer through ring gates to build a combo, dodge boulders. Highest score wins.
 *
 * Pure and seeded: the course depends only on the seed, so every player (and every online client)
 * runs the same street, and only the final score needs to be shared. No DOM here.
 */

import { createRng } from '@/game/engine/math';
import type { RingKind } from '@/game/data/ringRuns';

export const RUSH = {
  durationMs: 30_000,
  /** Lane centres across the street, which spans x = -1..1. */
  lanes: [-0.62, 0, 0.62] as const,
  /** Distance between course rows. */
  rowGap: 270,
  firstRowAt: 520,
  speedFrom: 400,
  speedTo: 620,
  /** Lateral steering speed, street units per second. */
  steer: 3.2,
  ringHalf: 0.27,
  boulderHalf: 0.25,
  stunMs: 700,
  points: { speed: 10, coin: 20, surge: 15 } satisfies Record<RingKind, number>,
  maxMultiplier: 5,
} as const;

export type RushRow =
  | { at: number; type: 'ring'; lane: number; kind: RingKind }
  | { at: number; type: 'boulder'; lanes: number[] };

export interface RushRunner {
  index: number;
  characterId: string;
  bot: boolean;
  skill: number;
  x: number;
  score: number;
  combo: number;
  bestCombo: number;
  rings: number;
  hits: number;
  stunUntil: number;
}

export interface RushEvent {
  type: 'ring' | 'miss' | 'crash';
  index: number;
  kind?: RingKind;
  points?: number;
}

export interface RushState {
  seed: number;
  now: number;
  durationMs: number;
  distance: number;
  course: RushRow[];
  /** The next course row nobody has reached yet. Runners move abreast, so one cursor serves all. */
  nextRow: number;
  runners: RushRunner[];
  /** Per bot, per row: the lane it will head for. Decided up front so a run replays exactly. */
  plans: number[][];
  over: boolean;
  events: RushEvent[];
}

export interface RushInput {
  /** -1..1 steering from keys. */
  mx: number;
  /** Where a finger or mouse is pointing on the street (-1..1), or null. Wins over mx. */
  target: number | null;
}

export const rushSpeed = (now: number, durationMs: number = RUSH.durationMs): number =>
  RUSH.speedFrom + (RUSH.speedTo - RUSH.speedFrom) * Math.min(1, now / durationMs);

export const rushMultiplier = (combo: number): number => Math.min(RUSH.maxMultiplier, 1 + Math.floor(combo / 3));

export function rushCourse(seed: number, durationMs: number = RUSH.durationMs): RushRow[] {
  const rng = createRng(seed);
  const length = ((RUSH.speedFrom + RUSH.speedTo) / 2) * (durationMs / 1000);
  const rows: RushRow[] = [];
  let lane = 1; // the last ring's lane; the next is never more than one over, so it is always reachable
  for (let at = RUSH.firstRowAt, i = 0; at < length; at += RUSH.rowGap, i++) {
    if (i % 3 === 2) {
      const open = Math.floor(rng() * 3);
      const blocked = [0, 1, 2].filter((l) => l !== open);
      rows.push({ at, type: 'boulder', lanes: rng() < 0.45 ? blocked : [blocked[Math.floor(rng() * 2)]] });
      continue;
    }
    lane = Math.max(0, Math.min(2, lane + Math.floor(rng() * 3) - 1));
    const roll = rng();
    rows.push({ at, type: 'ring', lane, kind: roll < 0.2 ? 'coin' : roll < 0.35 ? 'surge' : 'speed' });
  }
  return rows;
}

export function createRingRush(
  seed: number,
  roster: { characterId: string; bot: boolean; botSkill?: number }[],
  durationMs: number = RUSH.durationMs,
): RushState {
  const course = rushCourse(seed, durationMs);
  const runners = roster.map((r, index) => ({
    index,
    characterId: r.characterId,
    bot: r.bot,
    skill: r.botSkill ?? 0.5,
    x: roster.length > 1 ? -0.6 + (1.2 * index) / (roster.length - 1) : 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    rings: 0,
    hits: 0,
    stunUntil: 0,
  }));
  const plans = runners.map((r) => {
    const rng = createRng((seed ^ Math.imul(r.index + 1, 0x9e3779b1)) >>> 0);
    return course.map((row) => {
      const good = row.type === 'ring' ? row.lane : [0, 1, 2].find((l) => !row.lanes.includes(l))!;
      // A weaker bot picks a wrong lane more often.
      return rng() < (1 - r.skill) * 0.55 ? Math.floor(rng() * 3) : good;
    });
  });
  return { seed, now: 0, durationMs, distance: 0, course, nextRow: 0, runners, plans, over: false, events: [] };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function stepRingRush(s: RushState, inputs: (RushInput | null)[], dtMs: number): void {
  s.events.length = 0;
  if (s.over) return;
  s.now += dtMs;
  const dt = dtMs / 1000;
  s.distance += rushSpeed(s.now, s.durationMs) * dt;

  for (const r of s.runners) {
    if (s.now < r.stunUntil) continue;
    const input = inputs[r.index];
    const target = r.bot ? RUSH.lanes[s.plans[r.index][s.nextRow] ?? 1] : input?.target ?? null;
    const max = RUSH.steer * dt;
    const move = target !== null ? clamp(target - r.x, -max, max) : clamp(input?.mx ?? 0, -1, 1) * max;
    r.x = clamp(r.x + move, -0.9, 0.9);
  }

  while (s.nextRow < s.course.length && s.distance >= s.course[s.nextRow].at) {
    const row = s.course[s.nextRow++];
    for (const r of s.runners) {
      const stunned = s.now < r.stunUntil;
      if (row.type === 'boulder') {
        if (stunned || !row.lanes.some((l) => Math.abs(r.x - RUSH.lanes[l]) < RUSH.boulderHalf)) continue;
        r.combo = 0;
        r.hits++;
        r.stunUntil = s.now + RUSH.stunMs;
        s.events.push({ type: 'crash', index: r.index });
      } else if (!stunned && Math.abs(r.x - RUSH.lanes[row.lane]) <= RUSH.ringHalf) {
        r.combo += row.kind === 'surge' ? 2 : 1;
        r.bestCombo = Math.max(r.bestCombo, r.combo);
        r.rings++;
        const points = RUSH.points[row.kind] * rushMultiplier(r.combo);
        r.score += points;
        s.events.push({ type: 'ring', index: r.index, kind: row.kind, points });
      } else if (r.combo > 0) {
        r.combo = 0;
        s.events.push({ type: 'miss', index: r.index });
      }
    }
  }

  if (s.now >= s.durationMs) s.over = true;
}

export interface RushResult {
  index: number;
  characterId: string;
  placement: number;
  /** The score. Named like the Lok Drop's so the board and the online relay treat both alike. */
  banked: number;
}

export function rushResults(s: RushState): RushResult[] {
  return [...s.runners]
    .sort((a, b) => b.score - a.score || b.bestCombo - a.bestCombo || a.index - b.index)
    .map((r, i) => ({ index: r.index, characterId: r.characterId, placement: i + 1, banked: r.score }));
}
