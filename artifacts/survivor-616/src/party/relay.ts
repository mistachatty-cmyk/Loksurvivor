/**
 * Rooftop Relay: the ninth Lok Party mode, and the first team mode. Two teams of two race across the same
 * seeded rooftops: gaps to leap and vents to hop. Each team has one runner on the course at a time; at
 * the half-way line the baton passes to their partner (a clean first leg gives a turbo). One button:
 * tap to jump. Team 1 is seats 0 and 2, team 2 is seats 1 and 3; a human's tap jumps their team's
 * runner. Both teammates share the team's placement.
 *
 * Pure and seeded: no DOM. World units: distance along the course, from 0 to RELAY.length.
 */

import { createRng } from '@/game/engine/math';
import type { MinigameResult, MinigameSeat, StageInput } from './minigameKit';

export const RELAY = {
  length: 6000,
  speed: 270,
  turboSpeed: 340,
  turboMs: 1600,
  jumpMs: 600,
  jumpBufferMs: 130,
  gapWidth: 92,
  ventWidth: 34,
  stumbleMs: 900,
  ventSlowMs: 450,
  capMs: 42_000,
  /** Obstacles start after this and are spaced this far apart at minimum. */
  firstAt: 520,
  minSpacing: 330,
} as const;

export type ObstacleKind = 'gap' | 'vent';
export interface Obstacle {
  kind: ObstacleKind;
  x: number;
  w: number;
}

export interface Team {
  id: 0 | 1;
  seats: [number, number];
  x: number;
  /** Which leg is running: 0 or 1. */
  leg: 0 | 1;
  jumpUntil: number;
  jumpBuffered: number;
  stumbleUntil: number;
  slowUntil: number;
  turboUntil: number;
  lastStumbleAt: number;
  stumbles: number;
  finishedAt: number;
  passedAt: number;
  /** Obstacles already resolved, so each hurts at most once. */
  resolved: Set<number>;
  thinkNoise: number;
}

export interface RelayRunner {
  index: number;
  characterId: string;
  bot: boolean;
  skill: number;
  team: 0 | 1;
  leg: 0 | 1;
  stumbles: number;
}

export type RelayEvent =
  | { type: 'jump'; team: number }
  | { type: 'land'; team: number }
  | { type: 'stumble'; team: number; kind: ObstacleKind }
  | { type: 'pass'; team: number; clean: boolean }
  | { type: 'finish'; team: number; place: number }
  | { type: 'clear'; team: number; kind: ObstacleKind };

export interface RelayState {
  seed: number;
  rng: () => number;
  now: number;
  over: boolean;
  runners: RelayRunner[];
  teams: [Team, Team];
  obstacles: Obstacle[];
  finishOrder: number[];
  events: RelayEvent[];
  durationMs: number;
}

export function createRelay(seed: number, seats: MinigameSeat[]): RelayState {
  const rng = createRng(seed);
  const obstacles: Obstacle[] = [];
  let x: number = RELAY.firstAt;
  while (x < RELAY.length - 360) {
    const kind: ObstacleKind = rng() < 0.55 ? 'gap' : 'vent';
    obstacles.push({ kind, x, w: kind === 'gap' ? RELAY.gapWidth : RELAY.ventWidth });
    x += RELAY.minSpacing + rng() * 260;
  }
  const runners: RelayRunner[] = seats.map((seat, index) => ({
    index,
    characterId: seat.characterId,
    bot: seat.bot,
    skill: seat.botSkill ?? 0.5,
    team: (index % 2) as 0 | 1,
    leg: index < 2 ? 0 : 1,
    stumbles: 0,
  }));
  const mk = (id: 0 | 1): Team => ({
    id,
    seats: id === 0 ? [0, 2] : [1, 3],
    x: 0,
    leg: 0,
    jumpUntil: 0,
    jumpBuffered: -1e9,
    stumbleUntil: 0,
    slowUntil: 0,
    turboUntil: 0,
    lastStumbleAt: -1e9,
    stumbles: 0,
    finishedAt: 0,
    passedAt: 0,
    resolved: new Set(),
    thinkNoise: 0,
  });
  return { seed, rng, now: 0, over: false, runners, teams: [mk(0), mk(1)], obstacles, finishOrder: [], events: [], durationMs: RELAY.capMs };
}

export const activeSeat = (s: RelayState, team: Team): number => team.seats[team.leg];
export const isAirborne = (s: RelayState, t: Team) => s.now < t.jumpUntil;

/** The next obstacle ahead of x, with its index. */
function nextObstacle(s: RelayState, t: Team): { o: Obstacle; i: number } | null {
  for (let i = 0; i < s.obstacles.length; i++) {
    const o = s.obstacles[i];
    if (!t.resolved.has(i) && o.x + o.w > t.x - 4) return { o, i };
  }
  return null;
}

function tryJump(s: RelayState, t: Team) {
  if (isAirborne(s, t) || s.now < t.stumbleUntil) return false;
  t.jumpUntil = s.now + RELAY.jumpMs;
  s.events.push({ type: 'jump', team: t.id });
  return true;
}

export function stepRelay(s: RelayState, inputs: (StageInput | null)[], dtMs: number): void {
  s.events = [];
  if (s.over) return;
  s.now += dtMs;
  const dt = dtMs / 1000;

  for (const t of s.teams) {
    if (t.finishedAt) continue;
    const seat = s.runners[activeSeat(s, t)];

    // Who is steering: any human on the team, otherwise a bot's timing.
    let wantJump = false;
    let human = false;
    for (const idx of t.seats) {
      const r = s.runners[idx];
      if (!r || r.bot) continue;
      human = true;
      const input = inputs[idx] ?? null;
      if (input && (input.tap || input.action || input.keys.y < -0.6)) t.jumpBuffered = s.now;
    }
    if (!human && seat) {
      const nx = nextObstacle(s, t);
      if (nx) {
        const reach = (RELAY.speed * RELAY.jumpMs) / 1000;
        // Jump so the leap is centred over the obstacle, with a skill-based error.
        const centre = nx.o.x + nx.o.w / 2;
        const err = (1 - seat.skill) * 70 * Math.sin(nx.i * 12.9898 + t.id * 78.233);
        if (t.x + reach / 2 + err >= centre) wantJump = true;
      }
    }
    if (wantJump) t.jumpBuffered = s.now;
    if (s.now - t.jumpBuffered <= RELAY.jumpBufferMs && tryJump(s, t)) t.jumpBuffered = -1e9;

    // Move.
    const stumbled = s.now < t.stumbleUntil;
    let v: number = stumbled ? 0 : s.now < t.turboUntil ? RELAY.turboSpeed : RELAY.speed;
    if (!stumbled && s.now < t.slowUntil) v *= 0.55;
    t.x += v * dt;

    // Obstacles.
    for (let i = 0; i < s.obstacles.length; i++) {
      const o = s.obstacles[i];
      if (t.resolved.has(i)) continue;
      const over = t.x >= o.x && t.x <= o.x + o.w;
      if (over && !isAirborne(s, t)) {
        t.resolved.add(i);
        t.stumbles++;
        t.lastStumbleAt = s.now;
        if (seat) seat.stumbles++;
        if (o.kind === 'gap') {
          t.stumbleUntil = s.now + RELAY.stumbleMs;
          t.x = o.x - 18;
          t.resolved.delete(i);
        } else t.slowUntil = s.now + RELAY.ventSlowMs;
        if (o.kind === 'vent') t.x = Math.min(t.x, o.x + o.w);
        s.events.push({ type: 'stumble', team: t.id, kind: o.kind });
        if (o.kind === 'gap') break;
      } else if (t.x > o.x + o.w) {
        t.resolved.add(i);
        s.events.push({ type: 'clear', team: t.id, kind: o.kind });
      }
    }
    if (t.jumpUntil > s.now - dtMs && t.jumpUntil <= s.now) s.events.push({ type: 'land', team: t.id });

    // Hand-off at the half-way line.
    if (t.leg === 0 && t.x >= RELAY.length / 2) {
      t.leg = 1;
      t.passedAt = s.now;
      const clean = s.now - t.lastStumbleAt > 1500;
      if (clean) t.turboUntil = s.now + RELAY.turboMs;
      s.events.push({ type: 'pass', team: t.id, clean });
    }
    if (t.x >= RELAY.length) {
      t.finishedAt = s.now;
      s.finishOrder.push(t.id);
      s.events.push({ type: 'finish', team: t.id, place: s.finishOrder.length });
    }
  }

  if (s.finishOrder.length === 2 || s.now >= RELAY.capMs) s.over = true;
}

/** Team placement: finish order, else furthest along. */
export function teamOrder(s: RelayState): number[] {
  const done = [...s.finishOrder];
  const rest = s.teams.filter((t) => !t.finishedAt).sort((a, b) => b.x - a.x).map((t) => t.id);
  return [...done, ...rest];
}

export function relayResults(s: RelayState): MinigameResult[] {
  const order = teamOrder(s);
  const out = s.runners.map((r) => {
    const place = order.indexOf(r.team);
    const t = s.teams[r.team];
    const progress = Math.min(1, t.x / RELAY.length);
    const banked = Math.max(0, Math.round((place === 0 ? 100 : 40) * 1 + progress * 40 - r.stumbles * 6));
    return { r, place, banked };
  });
  out.sort((a, b) => a.place - b.place || b.banked - a.banked || a.r.index - b.r.index);
  return out.map((o, i) => ({ index: o.r.index, characterId: o.r.characterId, placement: i + 1, banked: o.banked }));
}
