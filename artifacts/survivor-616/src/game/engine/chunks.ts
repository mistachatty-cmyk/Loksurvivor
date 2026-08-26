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
export type BlockKind = 'storefronts' | 'residential' | 'parking' | 'industrial' | 'park' | 'bridge' | 'river-edge';
export type ChunkLandmarkKind = 'bridge' | 'market' | 'rail-yard' | 'plaza';

export interface ChunkLandmark {
  name: string;
  kind: ChunkLandmarkKind;
  accent: string;
}

export interface ChunkBuildingEntrance {
  x: number;
  y: number;
  label: string;
}

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
  blockKind: BlockKind;
  streetAxis: 'horizontal' | 'vertical';
  hasRiver: boolean;
  riverCrossingX: number | null;
  buildingEntrances: ChunkBuildingEntrance[];
  landmark?: ChunkLandmark;
}

/* ------------------------------------------------------------------ */
/* Chunk generation                                                    */
/* ------------------------------------------------------------------ */

const VARIANTS: ChunkVariant[] = ['strip', 'alley', 'parking', 'lot', 'market', 'rail', 'plaza'];
const BLOCK_KINDS: BlockKind[] = ['storefronts', 'residential', 'parking', 'industrial', 'park', 'bridge', 'river-edge'];
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

  // A river is a persistent horizontal band. Only every fourth block on the
  // band has a bridge; the other blocks are river edges and stay impassable.
  const hasRiver = cy !== 0 && ((cy % 6) + 6) % 6 === 3;
  const hasBridge = hasRiver && ((cx % 4) + 4) % 4 === 0;
  const riverCrossingX = hasBridge ? 0 : null;
  const blockKind = hasRiver
    ? (hasBridge ? 'bridge' : 'river-edge')
    : BLOCK_KINDS[(variantIndex + Math.abs(cx) + Math.abs(cy)) % BLOCK_KINDS.length]!;

  const landmark: ChunkLandmark | undefined = hasBridge
    ? { name: 'Northline Bridge', kind: 'bridge', accent: '#4de1ff' }
    : !hasRiver && variant === 'market'
      ? { name: 'Night Market', kind: 'market', accent: '#ff8bd8' }
      : !hasRiver && variant === 'rail'
        ? { name: 'East Yard', kind: 'rail-yard', accent: '#ffd166' }
        : !hasRiver && (variant === 'plaza' || blockKind === 'park')
          ? { name: 'Civic Plaza', kind: 'plaza', accent: '#a7f3d0' }
          : undefined;

  const obstacles: ObstacleDef[] = [];

  // Each block gets a different street spine. These are still ordinary
  // obstacles for collision, but the profiles make streamed blocks read as
  // streets, yards, and civic spaces instead of identical square rooms.
  const spine = Math.floor(rng() * 3);
  const streetAxis: 'horizontal' | 'vertical' = spine === 1 ? 'vertical' : 'horizontal';

  // Four-block-corner footprints make every generated chunk read as a city
  // block instead of an open arena. The central cross remains a safe route.
  const buildingLayouts = streetAxis === 'horizontal'
    ? [
        { x: -210, y: -208, w: 150, h: 120 },
        { x: 210, y: -208, w: 150, h: 120 },
        { x: -210, y: 208, w: 150, h: 120 },
        { x: 210, y: 208, w: 150, h: 120 },
      ]
    : [
        { x: -208, y: -210, w: 120, h: 150 },
        { x: -208, y: 210, w: 120, h: 150 },
        { x: 208, y: -210, w: 120, h: 150 },
        { x: 208, y: 210, w: 120, h: 150 },
      ];
  for (const building of buildingLayouts) {
    obstacles.push({ ...building, kind: 'building' });
  }

  // A persistent river row runs horizontally through the city. Split banks
  // around one bridge-sized opening so the same block coordinate is always a
  // crossing, while river-edge blocks remain impassable terrain.
  if (hasRiver) {
    if (hasBridge) {
      obstacles.push({ x: -220, y: 0, w: 400, h: 126, kind: 'river' });
      obstacles.push({ x: 220, y: 0, w: 400, h: 126, kind: 'river' });
    } else {
      obstacles.push({ x: 0, y: 0, w: CHUNK_SIZE, h: 126, kind: 'river' });
    }
  }
  if (variant === 'rail' || spine === 2) {
    for (const y of [-116, 116]) {
      obstacles.push({
        x: 0,
        y,
        w: variant === 'rail' ? 250 : 170,
        h: 14,
        kind: 'barrier',
      });
    }
  } else if (variant === 'market' || variant === 'plaza') {
    obstacles.push({ x: -142, y: -6, w: 18, h: 220, kind: 'barrier' });
    obstacles.push({ x: 142, y: 6, w: 18, h: 220, kind: 'barrier' });
  } else if (variant === 'alley') {
    obstacles.push({ x: -188, y: 0, w: 18, h: 250, kind: 'barrier' });
  }

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
    strip: [3, 6],
    alley: [4, 7],
    parking: [5, 8],
    lot: [2, 5],
    market: [5, 8],
    rail: [4, 7],
    plaza: [3, 6],
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
      building: [120, 180, 100, 150],
      river: [300, 400, 110, 126],
    };
    const [minW, maxW, minH, maxH] = sizes[kind];
    const w = minW + rng() * (maxW - minW);
    const h = minH + rng() * (maxH - minH);
    const margin = Math.max(w, h) / 2 + 24;

    // Scatter within chunk, keeping clear of the very centre and the
    // deterministic street spine. The rejection is bounded so generation
    // remains cheap and exactly reproducible.
    let attempts = 0;
    let x = 0;
    let y = 0;
    do {
      x = (rng() * 2 - 1) * (CHUNK_SIZE / 2 - margin);
      y = (rng() * 2 - 1) * (CHUNK_SIZE / 2 - margin);
      attempts += 1;
    } while (attempts < 8 && (
      (spine === 0 && Math.abs(y) < 48) ||
      (spine === 1 && Math.abs(x) < 48) ||
      (variant === 'rail' && Math.abs(y) > 78 && Math.abs(y) < 154)
    ));

    obstacles.push({ x, y, w, h, kind });
  }

  // Dungeon entrance: appears on roughly 1-in-8 chunks, never on the
  // starting (0,0) chunk.
  const isDungeonChunk = (cx !== 0 || cy !== 0) && rng() > 0.875;
  const entranceLocalX = isDungeonChunk ? (rng() - 0.5) * (CHUNK_SIZE * 0.4) : 0;
  const entranceLocalY = isDungeonChunk ? (rng() - 0.5) * (CHUNK_SIZE * 0.4) : 0;
  const buildingEntrances: ChunkBuildingEntrance[] = [];
  if (blockKind !== 'park') {
    buildingEntrances.push(
      { x: -135, y: streetAxis === 'horizontal' ? -142 : 0, label: blockKind === 'bridge' ? 'Bridge kiosk' : blockKind === 'storefronts' ? 'Corner shop' : 'Front door' },
      { x: 135, y: streetAxis === 'horizontal' ? 142 : 0, label: blockKind === 'bridge' ? 'Toll house' : blockKind === 'industrial' ? 'Loading bay' : 'Side entrance' },
    );
  }

  return {
    cx,
    cy,
    variant,
    obstacles,
    hasDungeonEntrance: isDungeonChunk,
    entranceLocalX,
    entranceLocalY,
    blockKind,
    streetAxis,
    hasRiver,
    riverCrossingX,
    buildingEntrances,
    landmark,
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
