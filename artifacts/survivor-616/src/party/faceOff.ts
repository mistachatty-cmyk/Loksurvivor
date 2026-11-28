/**
 * Face Off: the eighth Lok Party mode. Three prompts, eight seconds each: doodle a mustache, glasses, a
 * crown... straight onto your character's big face. The faint guide shows where it belongs; the more of
 * it you cover and the tidier you stay, the more points (up to 100 a round). Then every face is
 * revealed side by side.
 *
 * Pure and seeded: no DOM, bots "draw" along the same guides with a wobble that follows their skill.
 * World units: origin at the middle of the face canvas.
 */

import { createRng } from '@/game/engine/math';
import type { MinigameResult, MinigameSeat, StageInput } from './minigameKit';

export const FACE = {
  rounds: 3,
  drawMs: 8_000,
  revealMs: 1_500,
  roundMs: 9_500,
  cell: 8,
  halfW: 176,
  halfH: 200,
  brush: 13,
  /** Ink within this distance of the guide counts as on target. */
  tol: 15,
  maxPoints: 100,
  /** Penalty weight for ink off the guide. */
  messy: 0.55,
  cursorSpeed: 360,
} as const;

export type PromptId = 'mustache' | 'glasses' | 'crown' | 'blush' | 'brows';
export const PROMPTS: PromptId[] = ['mustache', 'glasses', 'crown', 'blush', 'brows'];

type Pt = { x: number; y: number };

const circle = (cx: number, cy: number, r: number, n = 22): Pt[] => Array.from({ length: n + 1 }, (_, i) => ({ x: cx + Math.cos((i / n) * Math.PI * 2) * r, y: cy + Math.sin((i / n) * Math.PI * 2) * r }));

/** The guide for a prompt: polylines the doodle should follow. */
export function guideFor(p: PromptId): Pt[][] {
  switch (p) {
    case 'mustache': {
      const l: Pt[] = [];
      for (let i = 0; i <= 14; i++) {
        const x = -104 + i * 14.857;
        l.push({ x, y: 44 + 0.0026 * x * x * 1.0 - 8 * Math.cos((x / 104) * Math.PI * 0.5) });
      }
      return [l];
    }
    case 'glasses':
      return [circle(-60, -28, 40), circle(60, -28, 40), [{ x: -20, y: -34 }, { x: 20, y: -34 }]];
    case 'crown':
      return [[{ x: -104, y: -104 }, { x: -104, y: -150 }, { x: -52, y: -122 }, { x: 0, y: -160 }, { x: 52, y: -122 }, { x: 104, y: -150 }, { x: 104, y: -104 }, { x: -104, y: -104 }]];
    case 'blush':
      return [circle(-84, 22, 22, 14), circle(-84, 22, 11, 10), circle(84, 22, 22, 14), circle(84, 22, 11, 10)];
    default:
      return [[{ x: -96, y: -78 }, { x: -62, y: -92 }, { x: -24, y: -80 }], [{ x: 24, y: -80 }, { x: 62, y: -92 }, { x: 96, y: -78 }]];
  }
}

const COLS = Math.ceil((FACE.halfW * 2) / FACE.cell);
const ROWS = Math.ceil((FACE.halfH * 2) / FACE.cell);
const cellOf = (x: number, y: number) => {
  const cx = Math.floor((x + FACE.halfW) / FACE.cell);
  const cy = Math.floor((y + FACE.halfH) / FACE.cell);
  return cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS ? -1 : cy * COLS + cx;
};

function segDist(px: number, py: number, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / l2));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

/** The target cells of a prompt (cached), as a Uint8Array of 0/1. */
const targetCache = new Map<PromptId, { cells: Uint8Array; count: number }>();
export function targetOf(p: PromptId) {
  let t = targetCache.get(p);
  if (t) return t;
  const cells = new Uint8Array(COLS * ROWS);
  const g = guideFor(p);
  let count = 0;
  for (let cy = 0; cy < ROWS; cy++)
    for (let cx = 0; cx < COLS; cx++) {
      const x = cx * FACE.cell - FACE.halfW + FACE.cell / 2;
      const y = cy * FACE.cell - FACE.halfH + FACE.cell / 2;
      let hit = false;
      for (const line of g) {
        for (let i = 0; i + 1 < line.length && !hit; i++) if (segDist(x, y, line[i], line[i + 1]) <= FACE.tol) hit = true;
        if (hit) break;
      }
      if (hit) {
        cells[cy * COLS + cx] = 1;
        count++;
      }
    }
  t = { cells, count };
  targetCache.set(p, t);
  return t;
}

export interface FaceRunner {
  index: number;
  characterId: string;
  bot: boolean;
  skill: number;
  ink: Uint8Array;
  /** Strokes this round: arrays of points, the last one is being drawn. */
  strokes: Pt[][];
  pen: Pt;
  penDown: boolean;
  /** Bots: the path they will follow and how far along it they are. */
  path: Pt[];
  pathAt: number;
  roundScores: number[];
  score: number;
}

export type FaceEvent =
  | { type: 'prompt'; round: number; prompt: PromptId }
  | { type: 'reveal'; round: number }
  | { type: 'ink'; index: number }
  | { type: 'scored'; index: number; points: number; rank: number };

export interface FaceState {
  seed: number;
  rng: () => number;
  now: number;
  durationMs: number;
  over: boolean;
  runners: FaceRunner[];
  prompts: PromptId[];
  round: number;
  roundStart: number;
  scored: boolean;
  events: FaceEvent[];
}

export function createFaceOff(seed: number, seats: MinigameSeat[]): FaceState {
  const rng = createRng(seed);
  const pool = [...PROMPTS];
  const prompts: PromptId[] = [];
  for (let i = 0; i < FACE.rounds; i++) prompts.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  const runners = seats.map(
    (seat, index): FaceRunner => ({
      index,
      characterId: seat.characterId,
      bot: seat.bot,
      skill: seat.botSkill ?? 0.5,
      ink: new Uint8Array(COLS * ROWS),
      strokes: [],
      pen: { x: 0, y: 0 },
      penDown: false,
      path: [],
      pathAt: 0,
      roundScores: [],
      score: 0,
    }),
  );
  const s: FaceState = { seed, rng, now: 0, durationMs: FACE.rounds * FACE.roundMs, over: false, runners, prompts, round: 0, roundStart: 0, scored: false, events: [] };
  beginRound(s, 0);
  return s;
}

/** A bot's wobbly path along the guide. */
function botPath(s: FaceState, r: FaceRunner, p: PromptId): Pt[] {
  const wobble = (1 - r.skill) * 15 + 2;
  const miss = (1 - r.skill) * 0.35;
  const out: Pt[] = [];
  const bias = { x: (s.rng() - 0.5) * (1 - r.skill) * 26, y: (s.rng() - 0.5) * (1 - r.skill) * 26 };
  for (const line of guideFor(p)) {
    // Interpolate to dense points so the pen moves smoothly.
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i];
      const b = line[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 10));
      for (let k = 0; k < n; k++) {
        if (s.rng() < miss * 0.12) continue; // skipped bit
        const t = k / n;
        out.push({ x: a.x + (b.x - a.x) * t + bias.x + (s.rng() - 0.5) * wobble * 2, y: a.y + (b.y - a.y) * t + bias.y + (s.rng() - 0.5) * wobble * 2 });
      }
    }
    out.push({ x: NaN, y: NaN }); // pen lift between polylines
  }
  return out;
}

function beginRound(s: FaceState, round: number) {
  s.round = round;
  s.roundStart = round * FACE.roundMs;
  s.scored = false;
  for (const r of s.runners) {
    r.ink = new Uint8Array(COLS * ROWS);
    r.strokes = [];
    r.penDown = false;
    r.pen = { x: 0, y: 0 };
    r.pathAt = 0;
    r.path = r.bot ? botPath(s, r, s.prompts[round]) : [];
  }
  s.events.push({ type: 'prompt', round, prompt: s.prompts[round] });
}

function inkAt(r: FaceRunner, x: number, y: number) {
  const b = Math.ceil(FACE.brush / FACE.cell);
  const c0 = cellOf(x, y);
  if (c0 < 0) return false;
  const cx = c0 % COLS;
  const cy = Math.floor(c0 / COLS);
  for (let dy = -b; dy <= b; dy++)
    for (let dx = -b; dx <= b; dx++) {
      if (Math.hypot(dx * FACE.cell, dy * FACE.cell) > FACE.brush) continue;
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS) r.ink[ny * COLS + nx] = 1;
    }
  return true;
}

function dab(r: FaceRunner, x: number, y: number, newStroke: boolean) {
  if (!inkAt(r, x, y)) return;
  if (newStroke || r.strokes.length === 0) r.strokes.push([]);
  r.strokes[r.strokes.length - 1].push({ x, y });
}

/** 0..100 for the current ink against the prompt. */
export function roundScore(r: FaceRunner, p: PromptId): number {
  const t = targetOf(p);
  let on = 0;
  let off = 0;
  for (let i = 0; i < r.ink.length; i++) {
    if (!r.ink[i]) continue;
    if (t.cells[i]) on++;
    else off++;
  }
  const cover = on / Math.max(1, t.count);
  const mess = (off / Math.max(1, t.count)) * FACE.messy;
  return Math.max(0, Math.min(FACE.maxPoints, Math.round(FACE.maxPoints * (Math.min(1, cover * 1.05) - mess))));
}

export const roundPhase = (s: FaceState): 'draw' | 'reveal' => (s.now - s.roundStart < FACE.drawMs ? 'draw' : 'reveal');

export function stepFaceOff(s: FaceState, inputs: (StageInput | null)[], dtMs: number): void {
  s.events = [];
  if (s.over) return;
  s.now += dtMs;
  const t = s.now - s.roundStart;
  const dt = dtMs / 1000;

  if (t < FACE.drawMs) {
    for (const r of s.runners) {
      if (r.bot) {
        // Advance along the path at a skill-based speed.
        let budget = (110 + r.skill * 170) * dt;
        while (budget > 0 && r.pathAt < r.path.length) {
          const p = r.path[r.pathAt];
          if (Number.isNaN(p.x)) {
            r.penDown = false;
            r.pathAt++;
            continue;
          }
          const d = Math.hypot(p.x - r.pen.x, p.y - r.pen.y);
          if (!r.penDown || d > 80) {
            r.pen = { x: p.x, y: p.y };
            dab(r, p.x, p.y, !r.penDown);
            r.penDown = true;
            r.pathAt++;
            budget -= 6;
            continue;
          }
          const step = Math.min(budget, d);
          if (d < 0.001) {
            r.pathAt++;
            continue;
          }
          r.pen = { x: r.pen.x + ((p.x - r.pen.x) / d) * step, y: r.pen.y + ((p.y - r.pen.y) / d) * step };
          dab(r, r.pen.x, r.pen.y, false);
          budget -= step;
          if (step >= d - 0.001) r.pathAt++;
        }
        continue;
      }
      const input = inputs[r.index] ?? null;
      let down = false;
      if (input?.holding && input.aim) {
        const x = Math.max(-FACE.halfW, Math.min(FACE.halfW, input.aim.x));
        const y = Math.max(-FACE.halfH, Math.min(FACE.halfH, input.aim.y));
        // Fill in between frames so a fast swipe leaves a line, not dots.
        const gap = Math.hypot(x - r.pen.x, y - r.pen.y);
        if (r.penDown && gap > 4 && gap < 200) {
          const n = Math.ceil(gap / 5);
          for (let k = 1; k <= n; k++) dab(r, r.pen.x + ((x - r.pen.x) * k) / n, r.pen.y + ((y - r.pen.y) * k) / n, false);
        } else dab(r, x, y, true);
        r.pen = { x, y };
        down = true;
      } else if (input && Math.hypot(input.keys.x, input.keys.y) > 0.1) {
        r.pen = {
          x: Math.max(-FACE.halfW, Math.min(FACE.halfW, r.pen.x + input.keys.x * FACE.cursorSpeed * dt)),
          y: Math.max(-FACE.halfH, Math.min(FACE.halfH, r.pen.y + input.keys.y * FACE.cursorSpeed * dt)),
        };
        dab(r, r.pen.x, r.pen.y, !r.penDown);
        down = true;
      }
      r.penDown = down;
    }
  } else if (!s.scored) {
    s.scored = true;
    const pts = s.runners.map((r) => roundScore(r, s.prompts[s.round]));
    const order = [...s.runners].sort((a, b) => pts[b.index] - pts[a.index] || a.index - b.index);
    for (const r of s.runners) {
      r.roundScores.push(pts[r.index]);
      r.score += pts[r.index];
      s.events.push({ type: 'scored', index: r.index, points: pts[r.index], rank: order.indexOf(r) + 1 });
    }
    s.events.push({ type: 'reveal', round: s.round });
  }

  if (t >= FACE.roundMs) {
    if (s.round + 1 >= FACE.rounds) s.over = true;
    else beginRound(s, s.round + 1);
  }
}

export function faceResults(s: FaceState): MinigameResult[] {
  return [...s.runners]
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((r, i) => ({ index: r.index, characterId: r.characterId, placement: i + 1, banked: r.score }));
}
