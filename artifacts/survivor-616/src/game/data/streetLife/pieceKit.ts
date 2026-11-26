/**
 * Street Life build kit: the reusable way to author things that sit on the street.
 *
 * A "piece" is a record: an id, a share of chunks, and a `build` function. Builders (`trackBuilder`,
 * `arcBuilder`, `lineBuilder`) cover the common shapes, so a new variant is one `definePiece` call with
 * numbers, not new code. Placement is a pure function of the chunk coordinates and run seed (never rng()),
 * so a seeded run always shows the same streets and nothing else in chunk generation shifts.
 *
 * To add a piece: append one `definePiece(...)` to `pieces.ts`. See docs/STREET_LIFE_BUILD_KIT.md.
 */

import { RING_GATE_RADIUS, ringHash } from '@/game/data/ringRuns';
import type { RingGateLayout, RingKind, RingTrackLayout } from '@/game/data/ringRuns';

/** What a builder is told about the chunk it is placing into. */
export interface PieceContext {
  cx: number;
  cy: number;
  seed: number;
  axis: 'horizontal' | 'vertical';
  /** Deterministic 0..1 value for this chunk; use a different `salt` for each independent choice. */
  roll(salt: number): number;
  /** A chunk-local point `along` the street spine and `across` it (the kit handles the street direction). */
  at(along: number, across: number): { x: number; y: number };
}

export interface PieceOutput {
  free?: RingGateLayout[];
  track?: RingTrackLayout;
}

export interface StreetPieceDef {
  id: string;
  name: string;
  /** Share of chunks (0..1) that get this piece. Pieces take turns along one roll, in list order. */
  chance: number;
  build(ctx: PieceContext): PieceOutput;
}

export function definePiece(def: StreetPieceDef): StreetPieceDef {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(def.id)) throw new Error(`piece id must be kebab-case: ${def.id}`);
  if (!(def.chance > 0 && def.chance <= 1)) throw new Error(`piece ${def.id}: chance must be in (0, 1]`);
  return def;
}

export function makeContext(cx: number, cy: number, seed: number, axis: 'horizontal' | 'vertical'): PieceContext {
  const horizontal = axis === 'horizontal';
  return {
    cx, cy, seed, axis,
    roll: (salt) => ringHash(seed, cx, cy, salt),
    at: (along, across) => (horizontal ? { x: along, y: across } : { x: across, y: along }),
  };
}

/** Pick one piece for a chunk: the roll walks through each piece's share in order. */
export function resolvePiece(pieces: readonly StreetPieceDef[], ctx: PieceContext): { piece: StreetPieceDef; output: PieceOutput } | null {
  let r = ctx.roll(1);
  for (const piece of pieces) {
    if (r < piece.chance) return { piece, output: piece.build(ctx) };
    r -= piece.chance;
  }
  return null;
}

const between = (min: number, max: number, t: number) => min + Math.floor(t * (max - min + 1));

/* ------------------------------ builders ------------------------------ */

export interface TrackOptions {
  /** Inclusive gate count range. */
  gates: [number, number];
  /** Track length along the street, at most about 560 so it fits in one chunk. */
  length: number;
  /** Sideways weave amplitude range. */
  sway: [number, number];
  /** Coins placed between each pair of gates. */
  coinsPerSegment?: number;
  /** First of three consecutive salts (count, phase, sway). */
  salt: number;
  /** Kind of each gate; the default is coins with a speed ring every third gate and a surge at the end. */
  kindFor?: (i: number, count: number) => RingKind;
}

const defaultTrackKind = (i: number, count: number): RingKind => (i === 0 ? 'coin' : i % 3 === 2 ? 'speed' : i === count - 1 ? 'surge' : 'coin');

export function trackBuilder(o: TrackOptions): (ctx: PieceContext) => PieceOutput {
  return (ctx) => {
    const count = between(o.gates[0], o.gates[1], ctx.roll(o.salt));
    const phase = ctx.roll(o.salt + 1) * Math.PI * 2;
    const sway = o.sway[0] + ctx.roll(o.salt + 2) * (o.sway[1] - o.sway[0]);
    const per = o.coinsPerSegment ?? 3;
    const kindFor = o.kindFor ?? defaultTrackKind;
    const pointAtT = (t: number) => ctx.at(-o.length / 2 + t * o.length, Math.sin(phase + t * Math.PI * 3) * sway);
    const gates: RingTrackLayout['gates'] = [];
    const coins: RingTrackLayout['coins'] = [];
    for (let i = 0; i < count; i += 1) {
      const p = pointAtT(i / (count - 1));
      gates.push({ x: p.x, y: p.y, kind: kindFor(i, count) });
      if (i < count - 1) {
        for (let c = 1; c <= per; c += 1) coins.push(pointAtT((i + c / (per + 1)) / (count - 1)));
      }
    }
    return { track: { gates, coins } };
  };
}

export interface ArcOptions {
  count: [number, number];
  /** Length along the street the arc covers. */
  span: number;
  /** Sideways bow of the arc. */
  bow: number;
  /** Chances for speed, then coin (the rest are surge rings). */
  speedShare: number;
  coinShare: number;
  /** First salt (count, then bow). */
  salt: number;
  /** Salt base for each ring's kind roll. */
  kindSalt: number;
}

export function arcBuilder(o: ArcOptions): (ctx: PieceContext) => PieceOutput {
  return (ctx) => {
    const count = between(o.count[0], o.count[1], ctx.roll(o.salt));
    const arc = 0.9 + ctx.roll(o.salt + 1) * 0.8;
    const free: RingGateLayout[] = [];
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const p = ctx.at(-o.span / 2 + t * o.span, Math.sin(t * Math.PI * arc) * o.bow - o.bow * 0.43);
      const roll = ctx.roll(o.kindSalt + i);
      free.push({ x: p.x, y: p.y, r: RING_GATE_RADIUS, kind: roll < o.speedShare ? 'speed' : roll < o.speedShare + o.coinShare ? 'coin' : 'surge' });
    }
    return { free };
  };
}

export interface LineOptions {
  count: [number, number];
  spacing: number;
  kind: RingKind;
  /** First salt (count, then start). */
  salt: number;
  /** Salt base for each ring's sideways jitter. */
  jitterSalt: number;
}

export function lineBuilder(o: LineOptions): (ctx: PieceContext) => PieceOutput {
  return (ctx) => {
    const count = between(o.count[0], o.count[1], ctx.roll(o.salt));
    const start = -120 + ctx.roll(o.salt + 1) * 120;
    const free: RingGateLayout[] = [];
    for (let i = 0; i < count; i += 1) {
      const p = ctx.at(start + i * o.spacing, (ctx.roll(o.jitterSalt + i) - 0.5) * 36);
      free.push({ x: p.x, y: p.y, r: RING_GATE_RADIUS, kind: o.kind });
    }
    return { free };
  };
}
