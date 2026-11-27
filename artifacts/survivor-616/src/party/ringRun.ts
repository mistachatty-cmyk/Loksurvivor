/**
 * ringRun.ts -- Ring Run Rush, a 30-second neon-street sprint (Lok Party minigame cartridge).
 *
 * Pure simulation: no DOM, no audio, no wall clock, and it never touches Math.random. The track is
 * a pure function of the seed, so every runner (and every device in an online party) sees the exact
 * same street. Each runner keeps their own distance; nobody blocks anybody, which keeps a phone
 * match fair and lets the online merge be a simple score report.
 *
 * The loop:
 *   - Three lanes. Swipe or tap to change lane, tap to jump.
 *   - Speed rings build a combo. Every 4 rings in a row raises the multiplier (x1 up to x8).
 *   - High rings only pay while you are in the air. Gold rings pay big but sit between rocks.
 *   - Rocks can be jumped. Walls cannot; switch lanes. A hit stuns, drops speed and breaks the combo.
 *   - Boost pads give a surge. The combo also fades if you go 2 seconds without a ring.
 *   - Highest score at 30 seconds wins; ties go to the higher peak multiplier.
 *
 * World space: distance runs along x (units), lanes are 0..2, z is height above the street.
 */

import { Coyote, InputBuffer } from './juiceEngine';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

export const RUSH = {
  durationMs: 30_000,
  lanes: 3,
  chunk: 520,
  baseSpeed: 330,
  speedPerMult: 24,
  boostSpeed: 170,
  boostMs: 1300,
  stunMs: 720,
  stunSpeedScale: 0.38,
  laneCooldownMs: 90,
  laneSmooth: 0.02,
  jumpVelocity: 540,
  gravity: 1550,
  maxMult: 8,
  ringsPerMult: 4,
  comboHoldMs: 2000,
  ringValue: 10,
  highValue: 20,
  goldValue: 40,
  boostValue: 15,
  pickRadius: 30,
  /** Heights: a ground ring pays under this z, a high ring over `highMinZ`. */
  groundRingMaxZ: 52,
  highMinZ: 34,
  rockMaxZ: 28,
  wallMaxZ: 112,
  startGap: 220,
} as const;

export type PieceKind = 'ring' | 'high' | 'gold' | 'rock' | 'wall' | 'boost';

export interface Piece {
  id: number;
  x: number;
  lane: number;
  kind: PieceKind;
}

export type RushEventKind =
  | 'ring'
  | 'high'
  | 'gold'
  | 'boost'
  | 'rock-hit'
  | 'wall-hit'
  | 'jump'
  | 'land'
  | 'lane'
  | 'mult-up'
  | 'combo-break'
  | 'combo-fade'
  | 'rush-warn'
  | 'finish';

export interface RushEvent {
  kind: RushEventKind;
  who: number;
  /** Distance and lane where it happened. */
  x: number;
  lane: number;
  value?: number;
  mult?: number;
  /** 0..1 weight for juice. */
  weight: number;
}

export interface RushPlayer {
  index: number;
  characterId: string;
  bot: boolean;
  botSkill: number;
  dist: number;
  lane: number;
  laneY: number;
  z: number;
  vz: number;
  grounded: boolean;
  boostUntil: number;
  stunUntil: number;
  laneReadyAt: number;
  combo: number;
  mult: number;
  peakMult: number;
  lastRingAt: number;
  score: number;
  rings: number;
  highRings: number;
  goldRings: number;
  hits: number;
  jumps: number;
  boosts: number;
  speed: number;
  jump: InputBuffer<'jump'>;
  coyote: Coyote;
  taken: Set<number>;
  /** Bot memory. */
  botThinkAt: number;
  botLane: number;
}

export interface RushState {
  seed: number;
  durationMs: number;
  now: number;
  players: RushPlayer[];
  chunks: Map<number, Piece[]>;
  warned: boolean;
  over: boolean;
  events: RushEvent[];
}

export interface RushInput {
  /** -1 = lane toward the top of the screen, +1 = toward the bottom, 0 = none. Fire on press. */
  laneDelta: number;
  jumpPressed: boolean;
}

export const NO_INPUT: RushInput = { laneDelta: 0, jumpPressed: false };

// ---------------------------------------------------------------------------
// Deterministic helpers
// ---------------------------------------------------------------------------

export function rushRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable 0..1 number from a few integers; used by bots so they never touch a shared rng. */
export function hash01(a: number, b: number, c: number): number {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca6b) ^ Math.imul(c | 0, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39) >>> 0;
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------
// The street: a pure function of (seed, chunk index)
// ---------------------------------------------------------------------------

type PatternId = 'line' | 'zig' | 'arc' | 'rocks' | 'wall' | 'gold' | 'boost' | 'weave';

const PATTERN_WEIGHTS: Record<PatternId, [number, number]> = {
  // [weight in the first chunks, weight once the street is busy]
  line: [5, 2],
  zig: [3, 3],
  arc: [3, 3],
  weave: [1, 3],
  boost: [2, 2],
  rocks: [0, 3],
  wall: [0, 3],
  gold: [0, 2],
};

/** Pieces for one chunk. Chunk 0 starts after a gap so nobody spawns inside a ring. */
export function trackChunk(seed: number, index: number): Piece[] {
  const rng = rushRng((seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0);
  const base = index * RUSH.chunk + (index === 0 ? RUSH.startGap : 0);
  const busy = Math.min(1, Math.max(0, (index - 1) / 5));
  const entries = Object.entries(PATTERN_WEIGHTS) as [PatternId, [number, number]][];
  const weights = entries.map(([, [a, b]]) => a + (b - a) * busy);
  const total = weights.reduce((n, w) => n + w, 0);
  let pick = rng() * total;
  let pattern: PatternId = 'line';
  for (let i = 0; i < entries.length; i += 1) {
    pick -= weights[i];
    if (pick <= 0) {
      pattern = entries[i][0];
      break;
    }
  }
  const out: Piece[] = [];
  const add = (dx: number, lane: number, kind: PieceKind) => {
    out.push({ id: index * 16 + out.length, x: base + dx, lane: Math.min(2, Math.max(0, lane)), kind });
  };
  const lane = Math.floor(rng() * 3);
  const other = (l: number) => (l + 1 + Math.floor(rng() * 2)) % 3;
  switch (pattern) {
    case 'line':
      for (let i = 0; i < 5; i += 1) add(40 + i * 78, lane, 'ring');
      break;
    case 'zig': {
      let l = lane;
      for (let i = 0; i < 6; i += 1) {
        add(30 + i * 70, l, 'ring');
        l = l === 1 ? (rng() < 0.5 ? 0 : 2) : 1;
      }
      break;
    }
    case 'arc':
      add(30, lane, 'ring');
      add(110, lane, 'high');
      add(190, lane, 'high');
      add(270, lane, 'high');
      add(350, lane, 'ring');
      break;
    case 'weave':
      for (let i = 0; i < 4; i += 1) {
        add(40 + i * 100, (lane + i) % 3, 'ring');
        add(70 + i * 100, (lane + i) % 3, 'ring');
      }
      break;
    case 'boost':
      add(30, lane, 'boost');
      for (let i = 0; i < 4; i += 1) add(150 + i * 70, lane, 'ring');
      break;
    case 'rocks': {
      const open = lane;
      add(60, (open + 1) % 3, 'rock');
      add(60, (open + 2) % 3, 'rock');
      for (let i = 0; i < 4; i += 1) add(140 + i * 74, open, 'ring');
      add(380, (open + 1) % 3, 'rock');
      add(440, open, 'ring');
      break;
    }
    case 'wall': {
      const open = lane;
      add(120, (open + 1) % 3, 'wall');
      add(120, (open + 2) % 3, 'wall');
      for (let i = 0; i < 5; i += 1) add(40 + i * 78, open, 'ring');
      break;
    }
    case 'gold': {
      const l = lane;
      const o = other(l);
      add(70, o, 'ring');
      add(150, l, 'rock');
      add(150, o === (l + 1) % 3 ? (l + 2) % 3 : (l + 1) % 3, 'rock');
      add(150 + 0, o, 'ring');
      add(220, o, 'gold');
      add(300, l, 'ring');
      add(374, l, 'ring');
      break;
    }
  }
  return out;
}

function chunkAt(s: RushState, index: number): Piece[] {
  let c = s.chunks.get(index);
  if (!c) {
    c = trackChunk(s.seed, index);
    s.chunks.set(index, c);
  }
  return c;
}

/** Pieces whose x falls in [from, to), in order. */
export function piecesBetween(s: RushState, from: number, to: number): Piece[] {
  const out: Piece[] = [];
  const first = Math.max(0, Math.floor(from / RUSH.chunk));
  const last = Math.floor(to / RUSH.chunk);
  for (let c = first; c <= last; c += 1) for (const p of chunkAt(s, c)) if (p.x >= from && p.x < to) out.push(p);
  out.sort((a, b) => a.x - b.x || a.lane - b.lane);
  return out;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export function createRingRun(seed: number, roster: { characterId: string; bot: boolean; botSkill?: number }[], durationMs: number = RUSH.durationMs): RushState {
  const lanes = [1, 0, 2, 1];
  const players = roster.slice(0, 4).map(
    (r, i): RushPlayer => ({
      index: i,
      characterId: r.characterId,
      bot: r.bot,
      botSkill: Math.min(1, Math.max(0, r.botSkill ?? 0.6)),
      dist: 0,
      lane: lanes[i],
      laneY: lanes[i],
      z: 0,
      vz: 0,
      grounded: true,
      boostUntil: 0,
      stunUntil: 0,
      laneReadyAt: 0,
      combo: 0,
      mult: 1,
      peakMult: 1,
      lastRingAt: -Infinity,
      score: 0,
      rings: 0,
      highRings: 0,
      goldRings: 0,
      hits: 0,
      jumps: 0,
      boosts: 0,
      speed: RUSH.baseSpeed,
      jump: new InputBuffer<'jump'>(),
      coyote: new Coyote(),
      taken: new Set<number>(),
      botThinkAt: 0,
      botLane: lanes[i],
    }),
  );
  return { seed, durationMs: Math.max(10_000, durationMs), now: 0, players, chunks: new Map(), warned: false, over: false, events: [] };
}

export function rushTimeLeftMs(s: RushState): number {
  return Math.max(0, s.durationMs - s.now);
}

// ---------------------------------------------------------------------------
// Step
// ---------------------------------------------------------------------------

/** Advance by `dtMs` (call with a fixed 1000/60). `inputs[i]` is ignored for bots. */
export function stepRingRun(s: RushState, inputs: (RushInput | null)[], dtMs: number): void {
  if (s.over) return;
  s.events = [];
  const dt = dtMs / 1000;
  s.now += dtMs;
  for (const p of s.players) {
    const inp = p.bot ? botThink(s, p) : inputs[p.index] ?? NO_INPUT;
    runPlayer(s, p, inp, dt);
  }
  if (!s.warned && rushTimeLeftMs(s) <= 5000) {
    s.warned = true;
    s.events.push({ kind: 'rush-warn', who: 0, x: s.players[0].dist, lane: 1, weight: 0.3 });
  }
  if (s.now >= s.durationMs) {
    s.over = true;
    s.events.push({ kind: 'finish', who: 0, x: s.players[0].dist, lane: 1, weight: 1 });
  }
}

function multFor(combo: number): number {
  return Math.min(RUSH.maxMult, 1 + Math.floor(combo / RUSH.ringsPerMult));
}

function runPlayer(s: RushState, p: RushPlayer, inp: RushInput, dt: number): void {
  const now = s.now;
  const stunned = now < p.stunUntil;

  // Lane change: fires on the press, with a short cooldown so a held swipe is one step.
  if (inp.laneDelta !== 0 && now >= p.laneReadyAt && !stunned) {
    const next = Math.min(RUSH.lanes - 1, Math.max(0, p.lane + Math.sign(inp.laneDelta)));
    if (next !== p.lane) {
      p.lane = next;
      p.laneReadyAt = now + RUSH.laneCooldownMs;
      s.events.push({ kind: 'lane', who: p.index, x: p.dist, lane: next, weight: 0.1 });
    }
  }
  p.laneY += (p.lane - p.laneY) * Math.min(1, dt * 1000 * RUSH.laneSmooth);

  // Jump: buffered 100 ms before landing, forgiven 80 ms after leaving the ground.
  if (inp.jumpPressed) p.jump.press('jump', now);
  if (p.grounded) p.coyote.mark(now);
  if (!stunned && p.jump.peek('jump', now) && p.coyote.ok(now)) {
    p.jump.consume('jump', now);
    p.coyote.spend();
    p.grounded = false;
    p.vz = RUSH.jumpVelocity;
    p.jumps += 1;
    s.events.push({ kind: 'jump', who: p.index, x: p.dist, lane: p.lane, weight: 0.2 });
  }
  if (!p.grounded) {
    p.vz -= RUSH.gravity * dt;
    p.z += p.vz * dt;
    if (p.z <= 0) {
      p.z = 0;
      p.vz = 0;
      p.grounded = true;
      s.events.push({ kind: 'land', who: p.index, x: p.dist, lane: p.lane, weight: 0.15 });
    }
  }

  // Speed: faster with the multiplier and a boost pad; crawling while stunned.
  const boosted = now < p.boostUntil;
  let speed = RUSH.baseSpeed + (p.mult - 1) * RUSH.speedPerMult + (boosted ? RUSH.boostSpeed : 0);
  if (stunned) speed *= RUSH.stunSpeedScale;
  p.speed = speed;
  const from = p.dist;
  p.dist += speed * dt;

  // Combo fades if no ring lands for a while.
  if (p.combo > 0 && now - p.lastRingAt > RUSH.comboHoldMs) {
    s.events.push({ kind: 'combo-fade', who: p.index, x: p.dist, lane: p.lane, weight: 0.1 });
    p.combo = 0;
    p.mult = 1;
  }

  collide(s, p, from, p.dist);
}

function collide(s: RushState, p: RushPlayer, from: number, to: number): void {
  const now = s.now;
  const laneNow = Math.round(p.laneY);
  const near = Math.abs(p.laneY - laneNow) < 0.34;
  const sweepFrom = from - RUSH.pickRadius * 0.5;
  const sweepTo = to + RUSH.pickRadius * 0.5;
  for (const pc of piecesBetween(s, sweepFrom, sweepTo)) {
    if (p.taken.has(pc.id)) continue;
    if (!near || pc.lane !== laneNow) continue;
    const stunned = now < p.stunUntil;
    switch (pc.kind) {
      case 'ring':
        if (p.z > RUSH.groundRingMaxZ) continue;
        takeRing(s, p, pc, RUSH.ringValue, 'ring');
        break;
      case 'high':
        if (p.z < RUSH.highMinZ) continue;
        takeRing(s, p, pc, RUSH.highValue, 'high');
        p.highRings += 1;
        break;
      case 'gold':
        if (p.z > 90) continue;
        takeRing(s, p, pc, RUSH.goldValue, 'gold');
        p.goldRings += 1;
        break;
      case 'boost':
        if (p.z > 20) continue;
        p.taken.add(pc.id);
        p.boostUntil = now + RUSH.boostMs;
        p.boosts += 1;
        p.score += RUSH.boostValue;
        s.events.push({ kind: 'boost', who: p.index, x: pc.x, lane: pc.lane, value: RUSH.boostValue, weight: 0.4 });
        break;
      case 'rock':
        if (p.z > RUSH.rockMaxZ) continue;
        p.taken.add(pc.id);
        if (!stunned) hurt(s, p, pc, 'rock-hit', 0.55);
        break;
      case 'wall':
        if (p.z > RUSH.wallMaxZ) continue;
        p.taken.add(pc.id);
        if (!stunned) hurt(s, p, pc, 'wall-hit', 0.8);
        break;
    }
  }
}

function takeRing(s: RushState, p: RushPlayer, pc: Piece, base: number, kind: 'ring' | 'high' | 'gold'): void {
  p.taken.add(pc.id);
  p.rings += 1;
  p.combo += 1;
  p.lastRingAt = s.now;
  const before = p.mult;
  p.mult = multFor(p.combo);
  if (p.mult > p.peakMult) p.peakMult = p.mult;
  const value = base * p.mult;
  p.score += value;
  s.events.push({ kind, who: p.index, x: pc.x, lane: pc.lane, value, mult: p.mult, weight: kind === 'gold' ? 0.7 : kind === 'high' ? 0.35 : 0.15 });
  if (p.mult > before) s.events.push({ kind: 'mult-up', who: p.index, x: pc.x, lane: pc.lane, mult: p.mult, weight: Math.min(1, 0.3 + p.mult * 0.09) });
}

function hurt(s: RushState, p: RushPlayer, pc: Piece, kind: 'rock-hit' | 'wall-hit', weight: number): void {
  p.hits += 1;
  p.stunUntil = s.now + RUSH.stunMs;
  const broke = p.combo > 0;
  p.combo = 0;
  p.mult = 1;
  p.boostUntil = 0;
  s.events.push({ kind, who: p.index, x: pc.x, lane: pc.lane, weight });
  if (broke) s.events.push({ kind: 'combo-break', who: p.index, x: pc.x, lane: pc.lane, weight: 0.3 });
}

// ---------------------------------------------------------------------------
// Bots
// ---------------------------------------------------------------------------

/**
 * Bots read the street ahead and score each lane. Skill sets how often they re-plan, how far they
 * look, and how often they slip. All randomness is a hash of (seat, time slice, seed): bots never
 * advance a shared rng, so lockstep replays and online devices agree.
 */
function botThink(s: RushState, p: RushPlayer): RushInput {
  const skill = p.botSkill;
  const think = 620 - 520 * skill;
  const out: RushInput = { laneDelta: 0, jumpPressed: false };
  const stunned = s.now < p.stunUntil;
  const look = 110 + 400 * skill;
  const ahead = piecesBetween(s, p.dist + 10, p.dist + look);

  if (s.now >= p.botThinkAt) {
    p.botThinkAt = s.now + think;
    const slice = Math.floor(s.now / Math.max(60, think));
    const slip = hash01(p.index + 1, slice, s.seed) < (1 - skill) * 0.5;
    // A mistake sends a low-skill runner to a lane picked by hash: rocks, walls and broken chains.
    if (slip && hash01(p.index + 3, slice, s.seed ^ 0x51) < 0.55) {
      p.botLane = Math.floor(hash01(p.index + 5, slice, s.seed ^ 0x77) * 3);
    } else if (!slip) {
      const value = [0, 0, 0];
      for (const pc of ahead) {
        const nearW = 1 + (1 - (pc.x - p.dist) / look);
        switch (pc.kind) {
          case 'ring':
            value[pc.lane] += 2 * nearW;
            break;
          case 'high':
            value[pc.lane] += 1.2 * nearW;
            break;
          case 'gold':
            value[pc.lane] += 5 * nearW;
            break;
          case 'boost':
            value[pc.lane] += 2.5 * nearW;
            break;
          case 'rock':
            value[pc.lane] -= 2.2 * nearW * (0.6 + 0.8 * (1 - skill));
            break;
          case 'wall':
            value[pc.lane] -= 14 * nearW;
            break;
        }
      }
      // Stay put unless another lane is clearly better; a little hysteresis stops zig-zag jitter.
      let best = p.botLane;
      let bestV = value[p.botLane] + 0.8;
      for (let l = 0; l < 3; l += 1) {
        if (l === p.botLane) continue;
        if (value[l] > bestV) {
          best = l;
          bestV = value[l];
        }
      }
      p.botLane = best;
    }
  }
  if (!stunned && p.lane !== p.botLane) out.laneDelta = Math.sign(p.botLane - p.lane);

  // Jump for rocks and high rings in the current lane, with a small timing slop at low skill.
  if (p.grounded && !stunned) {
    const slop = (1 - skill) * 90 * (hash01(p.index + 7, Math.floor(p.dist / 40), s.seed) - 0.5);
    for (const pc of ahead) {
      if (pc.lane !== p.lane) continue;
      const gap = pc.x - p.dist + slop;
      if ((pc.kind === 'rock' && gap < 112 && gap > 40) || (pc.kind === 'high' && gap < 70 && gap > 14)) {
        out.jumpPressed = true;
        break;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export interface RushResult {
  index: number;
  characterId: string;
  bot: boolean;
  placement: number;
  /** Final score; the number the board's online merge reports. */
  banked: number;
  rings: number;
  highRings: number;
  goldRings: number;
  peakMult: number;
  hits: number;
}

export function rushResults(s: RushState): RushResult[] {
  const order = [...s.players].sort((a, b) => b.score - a.score || b.peakMult - a.peakMult || b.rings - a.rings || a.index - b.index);
  return order.map((p, i) => ({
    index: p.index,
    characterId: p.characterId,
    bot: p.bot,
    placement: i + 1,
    banked: p.score,
    rings: p.rings,
    highRings: p.highRings,
    goldRings: p.goldRings,
    peakMult: p.peakMult,
    hits: p.hits,
  }));
}

/** Map a Ring Run Rush result onto the shared meta grade inputs. */
export function rushPerformance(s: RushState, r: RushResult) {
  const total = s.players.reduce((n, p) => n + p.score, 0) || 1;
  const bestRings = Math.max(1, ...s.players.map((p) => p.rings));
  return {
    characterId: r.characterId,
    placement: r.placement,
    players: s.players.length,
    objective: (r.banked / total) * 2,
    skill: r.rings / bestRings,
    clutch: (r.peakMult >= RUSH.maxMult ? 1 : 0) + (r.goldRings >= 2 ? 1 : 0) + (r.hits === 0 ? 1 : 0),
    risk: Math.min(1, (r.highRings + r.goldRings * 2) / 12),
    banked: r.banked,
    stats: { rings: r.rings, 'peak-multiplier': r.peakMult, 'gold-rings': r.goldRings },
  };
}
