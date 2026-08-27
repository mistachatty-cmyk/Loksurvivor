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
import { endlessBandForChunk } from '@/game/data/endlessBands';
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
export type BuildingPrefabId = 'corner-store' | 'duplex' | 'warehouse' | 'apartment' | 'laundromat' | 'clinic' | 'bar' | 'auto-shop';

export interface BuildingPrefab {
  id: BuildingPrefabId;
  name: string;
  sign: string;
  accent: string;
  footprint: { w: number; h: number };
  interiorBounds: { w: number; h: number };
  interiorProps: Array<Pick<ObstacleDef, 'x' | 'y' | 'w' | 'h' | 'kind' | 'propVariant'>>;
}

export interface ChunkBuilding {
  id: string;
  prefabId: BuildingPrefabId;
  name: string;
  sign: string;
  accent: string;
  x: number;
  y: number;
  w: number;
  h: number;
  doorX: number;
  doorY: number;
  doorSide: 'north' | 'south' | 'east' | 'west';
}

export interface ChunkLandmark {
  name: string;
  kind: ChunkLandmarkKind;
  accent: string;
}

export interface ChunkBuildingEntrance {
  x: number;
  y: number;
  label: string;
  buildingId: string;
  prefabId: BuildingPrefabId;
  doorSide: ChunkBuilding['doorSide'];
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
  buildings: ChunkBuilding[];
  district: string;
  districtAccent: string;
  band: import('@/game/types').EndlessBandId;
  bandAccent: string;
  landmark?: ChunkLandmark;
}

/* ------------------------------------------------------------------ */
/* Chunk generation                                                    */
/* ------------------------------------------------------------------ */

const VARIANTS: ChunkVariant[] = ['strip', 'alley', 'parking', 'lot', 'market', 'rail', 'plaza'];
const BLOCK_KINDS: BlockKind[] = ['storefronts', 'residential', 'parking', 'industrial', 'park', 'bridge', 'river-edge'];
const KINDS: ObstacleDef['kind'][] = ['car', 'dumpster', 'crate', 'planter', 'barrier', 'ac-unit', 'neon-sign', 'barrel', 'fuse-box', 'street-lamp', 'car-wreck', 'crate-breakable', 'cover', 'reflective-surface', 'flora', 'metal-box', 'bench'];

export const BUILDING_PREFABS: BuildingPrefab[] = [
  {
    id: 'corner-store',
    name: 'Corner Store',
    sign: 'OPEN LATE',
    accent: '#ff8bd8',
    footprint: { w: 176, h: 132 },
    interiorBounds: { w: 360, h: 280 },
    interiorProps: [
      { x: -100, y: -54, w: 120, h: 22, kind: 'crate', propVariant: 'fixed-bench' },
      { x: 92, y: 58, w: 78, h: 34, kind: 'crate-breakable', propVariant: 'light-breakable' },
      { x: 4, y: 78, w: 52, h: 34, kind: 'metal-box', propVariant: 'heavy-metal' },
    ],
  },
  {
    id: 'duplex',
    name: 'Two-Family Duplex',
    sign: '616 HOMES',
    accent: '#a7f3d0',
    footprint: { w: 184, h: 148 },
    interiorBounds: { w: 380, h: 300 },
    interiorProps: [
      { x: 0, y: -12, w: 18, h: 236, kind: 'building' },
      { x: -112, y: 74, w: 64, h: 28, kind: 'bench', propVariant: 'fixed-bench' },
      { x: 112, y: -72, w: 58, h: 42, kind: 'crate', propVariant: 'fixed-bench' },
    ],
  },
  {
    id: 'warehouse',
    name: 'Riverline Warehouse',
    sign: 'RIVERLINE FREIGHT',
    accent: '#ffd166',
    footprint: { w: 214, h: 156 },
    interiorBounds: { w: 430, h: 330 },
    interiorProps: [
      { x: -126, y: -68, w: 54, h: 54, kind: 'metal-box', propVariant: 'heavy-metal' },
      { x: -42, y: -68, w: 54, h: 54, kind: 'metal-box', propVariant: 'heavy-metal' },
      { x: 42, y: -68, w: 54, h: 54, kind: 'crate-breakable', propVariant: 'light-breakable' },
      { x: 126, y: -68, w: 54, h: 54, kind: 'crate-breakable', propVariant: 'light-breakable' },
      { x: 0, y: 80, w: 220, h: 18, kind: 'barrier', propVariant: 'fixed-bench' },
    ],
  },
  {
    id: 'apartment',
    name: 'Brick Walk-Up',
    sign: 'WALK-UP',
    accent: '#fda4af',
    footprint: { w: 158, h: 188 },
    interiorBounds: { w: 340, h: 390 },
    interiorProps: [
      { x: -105, y: -120, w: 58, h: 32, kind: 'bench', propVariant: 'fixed-bench' },
      { x: 100, y: -24, w: 42, h: 42, kind: 'crate', propVariant: 'fixed-bench' },
      { x: -82, y: 92, w: 116, h: 18, kind: 'barrier', propVariant: 'fixed-bench' },
    ],
  },
  {
    id: 'laundromat',
    name: 'Spin Cycle Laundromat',
    sign: 'SPIN CYCLE',
    accent: '#60a5fa',
    footprint: { w: 196, h: 128 },
    interiorBounds: { w: 390, h: 260 },
    interiorProps: [
      { x: -112, y: -62, w: 32, h: 32, kind: 'metal-box', propVariant: 'heavy-metal' },
      { x: -64, y: -62, w: 32, h: 32, kind: 'metal-box', propVariant: 'heavy-metal' },
      { x: -16, y: -62, w: 32, h: 32, kind: 'metal-box', propVariant: 'heavy-metal' },
      { x: 32, y: -62, w: 32, h: 32, kind: 'metal-box', propVariant: 'heavy-metal' },
      { x: 110, y: 68, w: 150, h: 18, kind: 'barrier', propVariant: 'fixed-bench' },
    ],
  },
  {
    id: 'clinic',
    name: 'Neighborhood Clinic',
    sign: 'CLINIC',
    accent: '#7ef0bd',
    footprint: { w: 206, h: 144 },
    interiorBounds: { w: 410, h: 290 },
    interiorProps: [
      { x: -112, y: -60, w: 70, h: 26, kind: 'bench', propVariant: 'fixed-bench' },
      { x: 8, y: -60, w: 70, h: 26, kind: 'bench', propVariant: 'fixed-bench' },
      { x: -98, y: 72, w: 48, h: 42, kind: 'fuse-box', propVariant: 'light-breakable' },
      { x: 100, y: 70, w: 62, h: 32, kind: 'crate-breakable', propVariant: 'light-breakable' },
    ],
  },
  {
    id: 'bar',
    name: 'Last Stop Bar',
    sign: 'LAST STOP',
    accent: '#c084fc',
    footprint: { w: 198, h: 136 },
    interiorBounds: { w: 400, h: 280 },
    interiorProps: [
      { x: -116, y: -68, w: 172, h: 22, kind: 'barrier', propVariant: 'fixed-bench' },
      { x: 118, y: -26, w: 30, h: 80, kind: 'neon-sign', propVariant: 'fixed-bench' },
      { x: -76, y: 76, w: 52, h: 32, kind: 'barrel', propVariant: 'light-breakable' },
      { x: 18, y: 76, w: 52, h: 32, kind: 'barrel', propVariant: 'light-breakable' },
    ],
  },
  {
    id: 'auto-shop',
    name: 'Northline Auto',
    sign: 'NORTHLINE AUTO',
    accent: '#fb923c',
    footprint: { w: 228, h: 164 },
    interiorBounds: { w: 450, h: 340 },
    interiorProps: [
      { x: -132, y: -82, w: 76, h: 54, kind: 'car-wreck', propVariant: 'medium-movable' },
      { x: 0, y: -82, w: 76, h: 54, kind: 'car-wreck', propVariant: 'medium-movable' },
      { x: 132, y: -82, w: 76, h: 54, kind: 'car-wreck', propVariant: 'medium-movable' },
      { x: -98, y: 86, w: 54, h: 54, kind: 'metal-box', propVariant: 'heavy-metal' },
      { x: 98, y: 86, w: 54, h: 54, kind: 'metal-box', propVariant: 'heavy-metal' },
    ],
  },
];

const BUILDING_PREFABS_BY_ID = Object.fromEntries(
  BUILDING_PREFABS.map((prefab) => [prefab.id, prefab]),
) as Record<BuildingPrefabId, BuildingPrefab>;

const DISTRICTS: Array<{ name: string; accent: string }> = [
  { name: 'Downtown Core', accent: '#ff8bd8' },
  { name: 'Westside Row', accent: '#a7f3d0' },
  { name: 'River Market', accent: '#4de1ff' },
  { name: 'Rail Cut', accent: '#ffd166' },
  { name: 'Warehouse Belt', accent: '#fb923c' },
  { name: 'Uptown Blocks', accent: '#c084fc' },
];

export function getBuildingPrefab(id: BuildingPrefabId): BuildingPrefab {
  return BUILDING_PREFABS_BY_ID[id] ?? BUILDING_PREFABS[0]!;
}

export function buildingWallObstacles(building: Pick<ChunkBuilding, 'x' | 'y' | 'w' | 'h' | 'doorX' | 'doorY' | 'doorSide'>): ObstacleDef[] {
  const thickness = 18;
  const doorWidth = 44;
  const walls: ObstacleDef[] = [];
  const { x, y, w, h, doorSide } = building;
  const addHorizontal = (wallY: number, openingX: number | null) => {
    if (openingX === null) {
      walls.push({ x, y: wallY, w, h: thickness, kind: 'building' });
      return;
    }
    const leftWidth = Math.max(24, openingX - (x - w / 2));
    const rightWidth = Math.max(24, (x + w / 2) - openingX - doorWidth);
    walls.push(
      { x: x - w / 2 + leftWidth / 2, y: wallY, w: leftWidth, h: thickness, kind: 'building' },
      { x: x + w / 2 - rightWidth / 2, y: wallY, w: rightWidth, h: thickness, kind: 'building' },
    );
  };
  const addVertical = (wallX: number, openingY: number | null) => {
    if (openingY === null) {
      walls.push({ x: wallX, y, w: thickness, h, kind: 'building' });
      return;
    }
    const topHeight = Math.max(24, openingY - (y - h / 2));
    const bottomHeight = Math.max(24, (y + h / 2) - openingY - doorWidth);
    walls.push(
      { x: wallX, y: y - h / 2 + topHeight / 2, w: thickness, h: topHeight, kind: 'building' },
      { x: wallX, y: y + h / 2 - bottomHeight / 2, w: thickness, h: bottomHeight, kind: 'building' },
    );
  };
  addHorizontal(y - h / 2, doorSide === 'north' ? x - doorWidth / 2 : null);
  addHorizontal(y + h / 2, doorSide === 'south' ? x - doorWidth / 2 : null);
  addVertical(x - w / 2, doorSide === 'west' ? y - doorWidth / 2 : null);
  addVertical(x + w / 2, doorSide === 'east' ? y - doorWidth / 2 : null);
  return walls;
}

/**
 * Generate a single chunk.  The run seed is mixed with the chunk
 * position so the output is stable but varies across the world.
 */
export function generateChunk(cx: number, cy: number, runSeed: number): StreetChunk {
  // Mix seed with position using primes so small deltas give big bit changes.
  const mixedSeed = (runSeed ^ (cx * 73856093)) ^ (cy * 19349663);
  const rng = createRng(mixedSeed >>> 0);
  const band = endlessBandForChunk(cx, cy, CHUNK_SIZE);

  const variantIndex = Math.floor(rng() * VARIANTS.length);
  const variant = VARIANTS[variantIndex] ?? 'strip';

  // A river is a persistent horizontal band. Only every fourth block on the
  // band has a bridge; the other blocks are river edges and stay impassable.
  const hasRiver = band.id !== 'outer-threshold' && cy !== 0 && ((cy % 6) + 6) % 6 === 3;
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
  const districtInfo = band.id === 'floodwall' || hasRiver
    ? DISTRICTS[2]!
    : band.id === 'rail-shadow'
      ? { name: 'Elevated Rail Shadows', accent: band.accent }
      : band.id === 'industrial-fringe'
        ? { name: 'Abandoned Industrial Fringe', accent: band.accent }
        : band.id === 'outer-threshold'
          ? { name: 'Outer-City Threshold', accent: band.accent }
          : DISTRICTS[(Math.abs(cx * 3 + cy * 5) + variantIndex) % DISTRICTS.length]!;

  // Each block gets a different street spine. These are still ordinary
  // obstacles for collision, but the profiles make streamed blocks read as
  // streets, yards, and civic spaces instead of identical square rooms.
  const spine = Math.floor(rng() * 3);
  const streetAxis: 'horizontal' | 'vertical' = spine === 1 ? 'vertical' : 'horizontal';

  // Four city-block corners are occupied by reusable building prefabs. Each
  // footprint is made from four wall segments with one real door opening, so
  // streets remain readable and the player can approach an actual facade.
  const buildings: ChunkBuilding[] = [];
  const prefabPools: Record<BlockKind, BuildingPrefabId[]> = {
    storefronts: ['corner-store', 'laundromat', 'bar', 'clinic'],
    residential: ['duplex', 'apartment', 'clinic'],
    parking: ['auto-shop', 'corner-store', 'laundromat'],
    industrial: ['warehouse', 'auto-shop', 'warehouse'],
    park: [],
    bridge: ['corner-store'],
    'river-edge': [],
  };
  const prefabPool = band.id === 'industrial-fringe'
    ? ['warehouse', 'auto-shop'] as BuildingPrefabId[]
    : band.id === 'outer-threshold'
      ? [] as BuildingPrefabId[]
      : prefabPools[blockKind];
  const anchors = streetAxis === 'horizontal'
    ? [
        { x: -198, y: -196, side: 'south' as const },
        { x: 198, y: -196, side: 'south' as const },
        { x: -198, y: 196, side: 'north' as const },
        { x: 198, y: 196, side: 'north' as const },
      ]
    : [
        { x: -196, y: -198, side: 'east' as const },
        { x: -196, y: 198, side: 'east' as const },
        { x: 196, y: -198, side: 'west' as const },
        { x: 196, y: 198, side: 'west' as const },
      ];
  if (blockKind !== 'river-edge' && prefabPool.length > 0) {
    anchors.forEach((anchor, index) => {
      const prefabId = prefabPool[(index + Math.abs(cx) + Math.abs(cy)) % prefabPool.length]!;
      const prefab = getBuildingPrefab(prefabId);
      const building: ChunkBuilding = {
        id: `${cx},${cy}:building:${index}`,
        prefabId,
        name: prefab.name,
        sign: prefab.sign,
        accent: prefab.accent,
        x: anchor.x,
        y: anchor.y,
        w: prefab.footprint.w,
        h: prefab.footprint.h,
        doorX: anchor.side === 'west'
          ? anchor.x - prefab.footprint.w / 2 - 18
          : anchor.side === 'east'
            ? anchor.x + prefab.footprint.w / 2 + 18
            : anchor.x,
        doorY: anchor.side === 'north'
          ? anchor.y - prefab.footprint.h / 2 - 18
          : anchor.side === 'south'
            ? anchor.y + prefab.footprint.h / 2 + 18
            : anchor.y,
        doorSide: anchor.side,
      };
      buildings.push(building);
      obstacles.push(...buildingWallObstacles(building));
    });
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
  const bandPropBonus = band.id === 'industrial-fringe' || band.id === 'outer-threshold' ? 2 : 0;
  const propCount = minProps + bandPropBonus + Math.floor(rng() * (maxProps - minProps + 1));

  const kindWeights: Record<ChunkVariant, number[]> = {
    // strip: lots of cars, some planters
    strip: [4, 1, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
    // alley: dumpsters and crates
    alley: [1, 3, 4, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1],
    // parking: mostly cars
    parking: [6, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1],
    // lot: mixed
     lot: [1, 2, 3, 2, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 3, 2, 1],
    // market: stalls, barriers, signs
     market: [1, 1, 3, 2, 4, 0, 3, 1, 1, 1, 0, 2, 2, 1, 3, 1, 2],
    // rail: long barriers, wrecks and signal boxes
     rail: [1, 0, 1, 0, 5, 1, 0, 1, 3, 2, 4, 1, 3, 2, 2, 3, 1],
    // plaza: open lanes with lamps and planters
     plaza: [0, 0, 1, 5, 3, 0, 1, 0, 1, 4, 0, 1, 2, 1, 4, 1, 3],
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
    let kind = KINDS[kindIdx] ?? 'crate';
    if (band.id === 'rail-shadow' && i % 3 === 0) kind = 'barrier';
    if (band.id === 'industrial-fringe' && i % 3 === 0) kind = 'metal-box';
    if (band.id === 'outer-threshold' && i % 2 === 0) kind = 'reflective-surface';

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
      'metal-box': [52, 76, 52, 76],
      bench: [90, 130, 24, 34],
      pothole: [58, 82, 46, 68],
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
      (variant === 'rail' && Math.abs(y) > 78 && Math.abs(y) < 154) ||
      (band.id === 'outer-threshold' && Math.abs(x) < 96 && Math.abs(y) < 96)
    ));

    const propVariant = kind === 'metal-box'
      ? 'heavy-metal'
      : kind === 'bench'
        ? 'fixed-bench'
        : kind === 'crate-breakable'
          ? 'light-breakable'
          : kind === 'dumpster' || kind === 'car-wreck' || kind === 'cover'
            ? 'medium-movable'
            : undefined;
    obstacles.push({ x, y, w, h, kind, propVariant });
  }

  // Potholes are rare, deterministic ground hazards. They are deliberately
  // generated separately from solid props so they never become collision
  // walls or projectile blockers.
  if (!hasRiver && rng() > (band.id === 'industrial-fringe' ? 0.62 : 0.78)) {
    const trigger = rng() > 0.5 ? 'stomp' : 'ground-shock';
    const w = 64 + rng() * 18;
    const h = 48 + rng() * 18;
    let x = 0;
    let y = 0;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      x = (rng() * 2 - 1) * (CHUNK_SIZE / 2 - Math.max(w, h) / 2 - 28);
      y = (rng() * 2 - 1) * (CHUNK_SIZE / 2 - Math.max(w, h) / 2 - 28);
      if (Math.abs(x) > 70 || Math.abs(y) > 70) break;
    }
    obstacles.push({
      x,
      y,
      w,
      h,
      kind: 'pothole',
      pothole: { trigger, warningMs: 760, openingMs: 520, lethalRadius: Math.min(w, h) * 0.42 },
    });
  }

  // Dungeon entrance: appears on roughly 1-in-8 chunks, never on the
  // starting (0,0) chunk.
  const isDungeonChunk = (cx !== 0 || cy !== 0) && rng() > (band.id === 'outer-threshold' ? 0.78 : 0.875);
  const entranceLocalX = isDungeonChunk ? (rng() - 0.5) * (CHUNK_SIZE * 0.4) : 0;
  const entranceLocalY = isDungeonChunk ? (rng() - 0.5) * (CHUNK_SIZE * 0.4) : 0;
  const buildingEntrances: ChunkBuildingEntrance[] = buildings.map((building) => ({
    x: building.doorX,
    y: building.doorY,
    label: building.sign,
    buildingId: building.id,
    prefabId: building.prefabId,
    doorSide: building.doorSide,
  }));

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
    buildings,
    district: districtInfo.name,
    districtAccent: districtInfo.accent,
    band: band.id,
    bandAccent: band.accent,
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
