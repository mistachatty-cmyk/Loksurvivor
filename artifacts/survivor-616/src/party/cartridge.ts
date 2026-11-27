/**
 * cartridge.ts -- the Lok Party minigame contract (pure types and rules, no React).
 *
 * A minigame is a "cartridge": a self-contained screen that takes the same few inputs, plays for
 * about 30 seconds, and hands back the same result shape. The board, the hub, the meta rewards and
 * the online score merge only ever talk to that shape, so adding a game means adding one cartridge
 * entry (see cartridges.tsx) and never editing the board.
 *
 * A cartridge must:
 *  - be a pure seeded sim underneath (same seed, same street/arena on every device, no Math.random,
 *    no wall clock in the rules), with bots that never draw from a shared rng;
 *  - take `botSkills` (0..1 each) and treat 0 as the human seat;
 *  - react on press, support touch, keyboard and gamepad through lokInput actions;
 *  - end by calling `onDone` once with a MiniOutcome.
 */

import type { applyMatch } from './lokPartyMeta';

export type MatchPerformance = Parameters<typeof applyMatch>[1];

/** One seat's result. `banked` is the score the online merge reports; placement 1 is the winner. */
export interface MiniResult {
  characterId: string;
  placement: number;
  banked: number;
}

export interface ReportLine {
  key: string;
  params?: Record<string, string | number>;
}

/** What every cartridge hands back when it ends. */
export interface MiniOutcome {
  seed: number;
  /** All four seats, human included. */
  results: MiniResult[];
  /** The human's grade inputs for the shared meta (mastery, ladder, pass). */
  perf: MatchPerformance;
  /** Optional extra lines for the results card, as locale keys. */
  extra?: ReportLine[];
  placement: number;
  players: number;
  banked: number;
}

export interface CartridgeProps {
  seed: number;
  playerId: string;
  botSkills: [number, number, number];
  durationMs: number;
  getAudioContext: () => AudioContext | null;
  onDone: (outcome: MiniOutcome) => void;
}

/** Deterministic hash used for rotation; never Math.random. */
function hash(a: number, b: number): number {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca6b)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39) >>> 0;
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/**
 * Which minigame a board round uses. A pure function of (seed, round), so every device agrees,
 * and it never repeats the previous round's game when more than one is available.
 */
export function minigameForRound(ids: readonly string[], seed: number, round: number): string {
  if (ids.length === 0) throw new Error('no minigames registered');
  if (ids.length === 1) return ids[0];
  let prev = -1;
  let pick = 0;
  for (let r = 1; r <= Math.max(1, round); r += 1) {
    const pool = ids.map((_, i) => i).filter((i) => i !== prev);
    pick = pool[Math.floor(hash(seed, r) * pool.length)];
    prev = pick;
  }
  return ids[pick];
}

/** Checks a result list is usable by the board: four seats, placements 1..4 once each. */
export function validResults(results: readonly MiniResult[], seats = 4): boolean {
  if (results.length !== seats) return false;
  const places = results.map((r) => r.placement).sort((a, b) => a - b);
  return places.every((p, i) => p === i + 1) && results.every((r) => Number.isFinite(r.banked));
}

/** Same seed for everyone on a given local calendar day, so a daily run is comparable. */
export function dailySeed(d: Date = new Date()): number {
  return Math.floor(hash(d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate(), 0x616) * 4294967296) >>> 0;
}
