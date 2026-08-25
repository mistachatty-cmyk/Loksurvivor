/**
 * Deterministic street-chunk generation for the endless mode.
 *
 * The endless world is divided into 640×640 world-unit chunks keyed by their
 * integer grid coordinates (cx, cy).  Each chunk is generated from the run
 * seed XOR'd with the chunk position so the same world always looks the same
 * for a given seed, but two runs with different seeds look different.
 *
 * Everything here is pure -- no mutable state, no world imports.
 */

import type { ObstacleDef } from '@/game/types';
import { createRng } from './math';

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

export const CHUNK_SIZE = 640;

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type ChunkVariant = 'strip' | 'alley' | 'parking' | 'lot' | 'market' | 'rail' | 'plaza';

export interface StreetChunk {
  cx: number;
  cy: number;
  variant: ChunkVariant;
  obstacles: ObstacleDef[];
  /**
   * If true this chunk contains a dungeon entrance.  The entrance
   * is positioned at (entranceLocalX, entranceLocalY) relative to
   * the chunk's top-left corner.
   */
  hasDungeonEntrance: boolean;
  entranceLocalX: number;
  entranceLocalY: number;
}

/* ------------------------------------------------------------------ */
/* Chunk generation                                                    */
/* ------------------------------------------------------------------ */

const VARIANTS: ChunkVariant[] = ['strip', 'alley', 'parking', 'lot', 'market', 'rail', 'plaza'];
const KINDS: ObstacleDef['kind'][] = ['car', 'dumpster', 'crate', 'planter', 'barrier', 'ac-unit', 'neon-sign', 'barrel', 'fuse-box', 'street-lamp', 'car-wreck', 'crate-breakable', 'cover', 'reflective-surface', 'flora'];

/**
 * Generate a single chunk.  The run seed is mixed with the chunk
 * position so the output is stable but varies across the world.
 */
export function generateChunk(cx: number, cy: number, runSeed: number): StreetChunk {
  // Mix seed with position using primes so small deltas give big bit changes.
  const mixedSeed = (runSeed ^ (cx * 73856093)) ^ (cy * 19349663);
  const rng = createRng(mixedSeed >>> 0);

  const variantIndex = Math.floor(rng() * VARIANTS.length);
  const variant = VARIANTS[variantIndex] ?? 'strip';

  const obstacles: ObstacleDef[] = [];

  // Sidewalk barriers along top/bottom edges (y = ±CHUNK_SIZE/2 ± padding).
  // Only add them on some chunks to avoid a feeling of rigid lanes.
  if (rng() > 0.35) {
    obstacles.push({
      x: (rng() * 0.5 - 0.25) * CHUNK_SIZE,
      y: -CHUNK_SIZE / 2 + 24,
      w: 90 + rng() * 80,
      h: 22,
      kind: 'barrier',
    });
  }
  if (rng() > 0.35) {
    obstacles.push({
      x: (rng() * 0.5 - 0.25) * CHUNK_SIZE,
      y: CHUNK_SIZE / 2 - 24,
      w: 90 + rng() * 80,
      h: 22,
      kind: 'barrier',
    });
  }

  // Interior props – number and kind depend on variant.
  const propCounts: Record<ChunkVariant, [number, number]> = {
    strip: [2, 4],
    alley: [3, 5],
    parking: [4, 7],
    lot: [1, 3],
    market: [4, 7],
    rail: [3, 6],
    plaza: [2, 5],
  };
  const [minProps, maxProps] = propCounts[variant];
  const propCount = minProps + Math.floor(rng() * (maxProps - minProps + 1));

  const kindWeights: Record<ChunkVariant, number[]> = {
    // strip: lots of cars, some planters
    strip: [4, 1, 1, 2, 1, 0],
    // alley: dumpsters and crates
    alley: [1, 3, 4, 1, 2, 1],
    // parking: mostly cars
    parking: [6, 1, 1, 0, 1, 0],
    // lot: mixed
     lot: [1, 2, 3, 2, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 3],
    // market: stalls, barriers, signs
     market: [1, 1, 3, 2, 4, 0, 3, 1, 1, 1, 0, 2, 2, 1, 3],
    // rail: long barriers, wrecks and signal boxes
     rail: [1, 0, 1, 0, 5, 1, 0, 1, 3, 2, 4, 1, 3, 2, 2],
    // plaza: open lanes with lamps and planters
     plaza: [0, 0, 1, 5, 3, 0, 1, 0, 1, 4, 0, 1, 2, 1, 4],
  };
  const weights = kindWeights[variant];

  for (let i = 0; i < propCount; i += 1) {
    // Weighted pick of obstacle kind.
    const totalW = weights.reduce((s, wt) => s + wt, 0);
    let roll = rng() * totalW;
    let kindIdx = 0;
    for (let k = 0; k < weights.length; k += 1) {
      roll -= weights[k]!;
      if (roll <= 0) {
        kindIdx = k;
        break;
      }
    }
    const kind = KINDS[kindIdx] ?? 'crate';

    // Sizes by kind.
    const sizes: Record<ObstacleDef['kind'], [number, number, number, number]> = {
      car: [100, 130, 44, 58],
      dumpster: [55, 75, 44, 58],
      crate: [44, 72, 44, 72],
      planter: [44, 72, 44, 72],
      barrier: [80, 160, 18, 28],
      'ac-unit': [44, 64, 44, 64],
      'neon-sign': [55, 70, 20, 72],
      barrel: [44, 58, 44, 58],
      'fuse-box': [42, 58, 42, 58],
      'street-lamp': [24, 34, 24, 34],
      'car-wreck': [110, 140, 48, 64],
      'crate-breakable': [44, 72, 44, 72],
      cover: [80, 140, 18, 28],
      'reflective-surface': [42, 58, 42, 58],
      'security-camera': [36, 48, 36, 48],
      flora: [28, 60, 28, 60],
    };
    const [minW, maxW, minH, maxH] = sizes[kind];
    const w = minW + rng() * (maxW - minW);
    const h = minH + rng() * (maxH - minH);
    const margin = Math.max(w, h) / 2 + 24;

    // Scatter within chunk, keeping clear of the very centre.
    const x = (rng() * 2 - 1) * (CHUNK_SIZE / 2 - margin);
    const y = (rng() * 2 - 1) * (CHUNK_SIZE / 2 - margin);

    obstacles.push({ x, y, w, h, kind });
  }

  // Dungeon entrance: appears on roughly 1-in-8 chunks, never on the
  // starting (0,0) chunk.
  const isDungeonChunk = (cx !== 0 || cy !== 0) && rng() > 0.875;
  const entranceLocalX = isDungeonChunk ? (rng() - 0.5) * (CHUNK_SIZE * 0.4) : 0;
  const entranceLocalY = isDungeonChunk ? (rng() - 0.5) * (CHUNK_SIZE * 0.4) : 0;

  return {
    cx,
    cy,
    variant,
    obstacles,
    hasDungeonEntrance: isDungeonChunk,
    entranceLocalX,
    entranceLocalY,
  };
}

/** World-space top-left corner of a chunk. */
export function chunkOrigin(cx: number, cy: number): { x: number; y: number } {
  return {
    x: cx * CHUNK_SIZE - CHUNK_SIZE / 2,
    y: cy * CHUNK_SIZE - CHUNK_SIZE / 2,
  };
}

/** Convert world coordinates to chunk grid coordinates. */
export function worldToChunkCoords(wx: number, wy: number): { cx: number; cy: number } {
  return {
    cx: Math.round(wx / CHUNK_SIZE),
    cy: Math.round(wy / CHUNK_SIZE),
  };
}

/** Chunk key string from grid coords. */
export function chunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}
