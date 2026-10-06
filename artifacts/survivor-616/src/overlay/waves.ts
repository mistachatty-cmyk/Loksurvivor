/**
 * What attacks you on a web page: a pure builder for the overlay's wave list, from the page's size.
 * The engine reads `area.waves` every tick (windows on `w.time`, in seconds), so the overlay swaps this list
 * into the running world rather than the engine knowing anything about pages. Zen mode builds none.
 *
 * Tiers escalate by time. Enemy ids are the game's own digital-glitch roster (checked against the real enemy
 * table by a test), so nothing here invents content.
 */
import type { WaveDef } from '@/game/types';

export interface WaveProfile {
  /** Blocks the scan found (a busier page spawns a little more). */
  blocks: number;
  zen?: boolean;
}

/** How long the scripted waves run; the level normally ends well before this (objective, not timer). */
export const WAVE_SPAN_SEC = 900;

/** 0.9 for a sparse page up to 1.5 for a huge one. */
export function pageSpawnScale(blocks: number): number {
  return Math.min(1.5, Math.max(0.9, 0.85 + Math.log10(Math.max(10, blocks)) / 5));
}

export function buildOverlayWaves(profile: WaveProfile): WaveDef[] {
  if (profile.zen) return [];
  const s = pageSpawnScale(profile.blocks);
  const to = WAVE_SPAN_SEC;
  const w = (fromSec: number, toSec: number, enemyId: string, ratePerSec: number, burst: number, extra: Partial<WaveDef> = {}): WaveDef => ({
    fromSec,
    toSec,
    enemyId,
    ratePerSec: Math.round(ratePerSec * s * 100) / 100,
    burst,
    ...extra,
  });
  return [
    // the swarm that never stops, tougher every few minutes
    w(0, 40, 'dust-mite', 1.6, 2), // a gentler opening: the first seconds are for learning the controls
    w(40, 120, 'dust-mite', 3.2, 3),
    w(120, 300, 'dust-mite', 3.6, 3, { hpMult: 2.2 }),
    w(300, to, 'dust-mite', 4, 4, { hpMult: 4 }),
    w(35, 200, 'cursor-hound', 1.0, 2),
    w(200, to, 'cursor-hound', 1.2, 2, { hpMult: 2.6 }),
    w(60, to, 'dead-pixel-swarm', 0.45, 4, { formation: 'ring' }),
    w(90, 300, 'dropped-frame', 0.9, 2, { hpMult: 1.4 }),
    w(300, to, 'dropped-frame', 1.0, 2, { hpMult: 3 }),
    w(120, to, 'packet-wraith', 0.8, 2),
    w(130, to, 'firewall-brute', 0.22, 1, { hpMult: 1.6 }),
    w(170, to, 'drift-shard', 0.7, 3),
    // mid-level bosses: a short window at a low rate releases exactly one
    w(180, 186, 'heap-colossus', 0.2, 1, { hpMult: 2 }),
    w(360, 366, 'heap-colossus', 0.2, 1, { hpMult: 3 }),
    w(540, 546, 'heap-colossus', 0.2, 2, { hpMult: 4 }),
  ];
}

/** The page's final boss, released on demand once the level is far enough along. */
export function finaleWave(nowSec: number): WaveDef {
  return { fromSec: nowSec, toSec: nowSec + 6, enemyId: 'stack-overflow', ratePerSec: 0.25, burst: 1, hpMult: 1, faction: 'Stack Overflow' };
}

export const FINALE_BOSS_ID = 'stack-overflow';
