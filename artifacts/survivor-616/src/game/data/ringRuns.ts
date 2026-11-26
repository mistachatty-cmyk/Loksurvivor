/**
 * Ring gates, Ring Runs and Victory Tokens (Street Life).
 *
 * Everything here is pure data and placement math. Layouts come from the chunk coordinates and the run
 * seed through a small hash, never from rng(), so a seeded run always shows the same rings and nothing
 * else in chunk generation shifts. The simulation (world.ts) reads these records.
 */

export type RingKind = 'speed' | 'coin' | 'surge';

export interface RingStyle {
  kind: RingKind;
  name: string;
  color: string;
  glow: string;
}

export const RING_STYLES: Record<RingKind, RingStyle> = {
  speed: { kind: 'speed', name: 'Speed ring', color: '#46e6ff', glow: '#b5f7ff' },
  coin: { kind: 'coin', name: 'Coin ring', color: '#ffc94d', glow: '#fff0b0' },
  surge: { kind: 'surge', name: 'Surge ring', color: '#e86bff', glow: '#f9c4ff' },
};

/** A gate as laid out inside one chunk: chunk-local centre. */
export interface RingGateLayout {
  x: number;
  y: number;
  r: number;
  kind: RingKind;
}

export interface RingTrackLayout {
  /** Gate centres in order, chunk-local. The first is the start gate, the last the finish. */
  gates: Array<{ x: number; y: number; kind: RingKind }>;
  /** Coin centres between the gates, chunk-local, in path order. */
  coins: Array<{ x: number; y: number }>;
}

export interface ChunkRingLayout {
  free: RingGateLayout[];
  track: RingTrackLayout | null;
}

/** Deterministic 0..1 hash of (seed, cx, cy, salt). */
export function ringHash(seed: number, cx: number, cy: number, salt: number): number {
  let h = (seed | 0) ^ Math.imul(cx | 0, 0x27d4eb2d) ^ Math.imul(cy | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export const RING_GATE_RADIUS = 34;
export const RING_TRACK_GATE_RADIUS = 38;

/* ------------------------------------------------------------------ */
/* Victory tokens: the explosion after a Ring Run win                   */
/* ------------------------------------------------------------------ */

export type BurstTokenKind = 'gold' | 'red' | 'purple' | 'teal' | 'green' | 'blue' | 'white';

export interface BurstTokenDef {
  kind: BurstTokenKind;
  name: string;
  color: string;
  trim: string;
  /** Relative odds in a normal burst. */
  weight: number;
  /** One line shown when it is collected. */
  popup: string;
  /** Plain-language effect, for docs and the codex. */
  effect: string;
}

export const BURST_TOKENS: BurstTokenDef[] = [
  { kind: 'gold', name: 'Gold token', color: '#ffc94d', trim: '#fff0b0', weight: 46, popup: 'CRED', effect: 'Cred. Bigger on higher placings.' },
  { kind: 'red', name: 'Red token', color: '#ff5a4d', trim: '#ffc2bd', weight: 14, popup: 'ATTACK UP', effect: 'Damage up 30 percent for 40 seconds. One in ten also adds 2 percent permanent power for the run.' },
  { kind: 'purple', name: 'Purple token', color: '#a45cff', trim: '#e3caff', weight: 7, popup: 'ALL STATS UP', effect: 'A small permanent boost to power, area, speed and pickup reach for the run.' },
  { kind: 'teal', name: 'Teal token', color: '#2fe0c8', trim: '#c4fff6', weight: 6, popup: 'SUPER EMPOWERED', effect: 'Gilded for 8 seconds, plus a pile of cred and XP.' },
  { kind: 'green', name: 'Green token', color: '#4de07a', trim: '#c8ffd9', weight: 12, popup: 'HEALED', effect: 'Heals 35 percent of max health.' },
  { kind: 'blue', name: 'Blue token', color: '#4d9bff', trim: '#cbe2ff', weight: 9, popup: 'OVERSHIELD', effect: 'A shield that soaks damage for 25 seconds.' },
  { kind: 'white', name: 'White token', color: '#f4f4ff', trim: '#ffffff', weight: 6, popup: 'LOK TOKEN', effect: 'A Lok token added to the run rewards.' },
];

export const BURST_TOKENS_BY_KIND: Record<BurstTokenKind, BurstTokenDef> = Object.fromEntries(
  BURST_TOKENS.map((t) => [t.kind, t]),
) as Record<BurstTokenKind, BurstTokenDef>;

/** Pick a token kind from a 0..1 roll; `luck` (0..1) shifts weight from gold toward the rarer kinds. */
export function rollBurstToken(roll: number, luck: number): BurstTokenKind {
  const weights = BURST_TOKENS.map((t) => (t.kind === 'gold' ? t.weight * (1 - 0.6 * luck) : t.weight * (1 + 0.8 * luck)));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = roll * total;
  for (let i = 0; i < BURST_TOKENS.length; i += 1) {
    r -= weights[i]!;
    if (r <= 0) return BURST_TOKENS[i]!.kind;
  }
  return 'gold';
}

/** How many tokens a finish drops: first place is a big blast. */
export function burstTokenCount(place: 1 | 2 | 3): number {
  return place === 1 ? 26 : place === 2 ? 16 : 8;
}
