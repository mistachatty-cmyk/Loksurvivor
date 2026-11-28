/**
 * Red Light, Green Light: the eighth Lok Party mode. A giant owl stands at the far end of the track. On
 * green everyone taps as fast as they can to run toward it. The owl's head swivels (a short warning), then
 * it turns around and its eyes go red: anyone who taps after that is zapped by a laser and blown up. Anyone
 * can fail; the owl does not care who you are. Finish the track to win; if nobody can, whoever got furthest
 * alive takes it.
 *
 * Pure and seeded: no DOM. Distances are 0..TRACK. Input: a tap (or Space/Enter) moves you forward one step.
 */

import { createRng } from '@/game/engine/math';
import type { MinigameResult, MinigameSeat, StageInput } from './minigameKit';

export const LIGHT = {
  track: 100,
  /** Distance gained per tap. */
  step: 2.1,
  durationMs: 45000,
  greenMin: 2000,
  greenMax: 3800,
  redMin: 1400,
  redMax: 2600,
  /** The owl's head swivels for this long before the eyes go red: moving is still safe. */
  warnMs: 450,
  /** A finger already in flight when the light goes red is forgiven for this long. */
  graceMs: 160,
} as const;

export type LightPhase = 'green' | 'warn' | 'red';

export interface LightRunner {
  index: number;
  characterId: string;
  bot: boolean;
  skill: number;
  dist: number;
  alive: boolean;
  /** 0 until they finish, then 1 for first across the line, 2 for second... */
  finishOrder: number;
  taps: number;
  /** Bots: when the next tap lands, when they notice the warning, and whether they gamble through red. */
  botNextTap: number;
  botStopAt: number;
  botGamble: boolean;
  zappedAt: number;
}

export type LightEvent =
  | { type: 'green' }
  | { type: 'warn' }
  | { type: 'red' }
  | { type: 'tap'; index: number }
  | { type: 'zap'; index: number; dist: number }
  | { type: 'finish'; index: number; order: number };

export interface LightState {
  seed: number;
  rng: () => number;
  now: number;
  durationMs: number;
  over: boolean;
  runners: LightRunner[];
  phase: LightPhase;
  phaseStart: number;
  phaseUntil: number;
  /** How many full red lights have passed (for pacing flavour). */
  cycles: number;
  finished: number;
  events: LightEvent[];
}

export function createRedLight(seed: number, seats: MinigameSeat[]): LightState {
  const rng = createRng(seed);
  const runners = seats.map(
    (seat, index): LightRunner => ({
      index,
      characterId: seat.characterId,
      bot: seat.bot,
      skill: seat.botSkill ?? 0.55,
      dist: 0,
      alive: true,
      finishOrder: 0,
      taps: 0,
      botNextTap: 0,
      botStopAt: Infinity,
      botGamble: false,
      zappedAt: -1,
    }),
  );
  return {
    seed,
    rng,
    now: 0,
    durationMs: LIGHT.durationMs,
    over: false,
    runners,
    phase: 'green',
    phaseStart: 0,
    phaseUntil: LIGHT.greenMin + rng() * (LIGHT.greenMax - LIGHT.greenMin),
    cycles: 0,
    finished: 0,
    events: [],
  };
}

const botInterval = (skill: number) => 1000 / (5 + 4 * skill);

function advancePhase(s: LightState) {
  s.phaseStart = s.now;
  if (s.phase === 'green') {
    s.phase = 'warn';
    s.phaseUntil = s.now + LIGHT.warnMs;
    s.events.push({ type: 'warn' });
    // Each bot notices the swivel after its own reaction time: quick bots stop in time, slow ones might not.
    for (const r of s.runners) {
      if (!r.bot) continue;
      const reaction = 180 + (1 - r.skill) * 520 + s.rng() * 180;
      r.botStopAt = s.now + reaction;
    }
  } else if (s.phase === 'warn') {
    s.phase = 'red';
    s.phaseUntil = s.now + LIGHT.redMin + s.rng() * (LIGHT.redMax - LIGHT.redMin);
    s.events.push({ type: 'red' });
    for (const r of s.runners) if (r.bot) r.botGamble = s.rng() < 0.05 * (1 - r.skill) + 0.02;
  } else {
    s.phase = 'green';
    s.phaseUntil = s.now + LIGHT.greenMin + s.rng() * (LIGHT.greenMax - LIGHT.greenMin);
    s.cycles += 1;
    s.events.push({ type: 'green' });
    for (const r of s.runners) {
      if (!r.bot) continue;
      r.botStopAt = Infinity;
      r.botGamble = false;
      r.botNextTap = s.now + 120 + s.rng() * 200;
    }
  }
}

export function stepRedLight(s: LightState, inputs: (StageInput | null)[], dtMs: number): void {
  s.events = [];
  if (s.over) return;
  s.now += dtMs;
  while (s.now >= s.phaseUntil) advancePhase(s);
  for (const r of s.runners) {
    if (!r.alive || r.finishOrder > 0) continue;
    let tapped = false;
    if (r.bot) {
      if (s.now >= r.botNextTap && (s.now < r.botStopAt || r.botGamble)) {
        tapped = true;
        r.botNextTap = s.now + botInterval(r.skill) * (0.8 + s.rng() * 0.4);
      }
    } else {
      const inp = inputs[r.index];
      tapped = !!inp && (!!inp.tap || inp.action);
    }
    if (!tapped) continue;
    if (s.phase === 'red' && s.now - s.phaseStart > LIGHT.graceMs) {
      r.alive = false;
      r.zappedAt = s.now;
      s.events.push({ type: 'zap', index: r.index, dist: r.dist });
      continue;
    }
    r.taps += 1;
    r.dist = Math.min(LIGHT.track, r.dist + LIGHT.step);
    s.events.push({ type: 'tap', index: r.index });
    if (r.dist >= LIGHT.track) {
      s.finished += 1;
      r.finishOrder = s.finished;
      s.events.push({ type: 'finish', index: r.index, order: s.finished });
    }
  }
  if (s.now >= s.durationMs || s.runners.every((r) => !r.alive || r.finishOrder > 0)) s.over = true;
}

/** Score: finishers 100+, still running 0..99 by distance, blown up half their distance. */
export function lightScore(s: LightState, r: LightRunner): number {
  if (r.finishOrder > 0) return 100 + (s.runners.length - r.finishOrder) * 5;
  return Math.round(r.alive ? r.dist : r.dist * 0.5);
}

export function lightResults(s: LightState): MinigameResult[] {
  return [...s.runners]
    .sort((a, b) => lightScore(s, b) - lightScore(s, a) || b.dist - a.dist || a.index - b.index)
    .map((r, i) => ({ index: r.index, characterId: r.characterId, placement: i + 1, banked: lightScore(s, r) }));
}
