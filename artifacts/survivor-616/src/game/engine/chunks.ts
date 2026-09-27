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

export type ChunkVariant = 'strip' | 'alley' | 'parking' | 'lot' | 'market' | 'rail' | 'plaza' | 'scrapyard' | 'overpass';
export type BlockKind = 'storefronts' | 'residential' | 'parking' | 'industrial' | 'park' | 'bridge' | 'river-edge';
export type ChunkLandmarkKind = 'bridge' | 'market' | 'rail-yard' | 'plaza' | 'scrapyard' | 'overpass';
export type BuildingPrefabId =
  | 'corner-store'
  | 'duplex'
  | 'warehouse'
  | 'apartment'
  | 'laundromat'
  | 'clinic'
  | 'bar'
  | 'auto-shop'
  | 'penthouse'
  | 'antenna-hub'
  | 'catacomb-crypt'
  | 'server-cluster'
  | 'harbor-office'
  | 'toll-plaza'
  | 'lev-substation'
  | 'skyline-spire'
  | 'nanite-foundry'
  | (string & {});

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

const VARIANTS: ChunkVariant[] = ['strip', 'alley', 'parking', 'lot', 'market', 'rail', 'plaza', 'scrapyard', 'overpass'];
const BLOCK_KINDS: BlockKind[] = ['storefronts', 'residential', 'parking', 'industrial', 'park', 'bridge', 'river-edge'];
const KINDS: ObstacleDef['kind'][] = ['car', 'dumpster', 'crate', 'planter', 'barrier', 'ac-unit', 'neon-sign', 'barrel', 'fuse-box', 'street-lamp', 'car-wreck', 'crate-breakable', 'cover', 'reflective-surface', 'flora', 'metal-box', 'bench', 'trash-can', 'mailbox', 'fire-hydrant', 'parking-meter'];

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
  {
    id: 'penthouse',
    name: 'Skyline Penthouse',
    sign: 'PENTHOUSE 616',
    accent: '#c084fc',
    footprint: { w: 196, h: 148 },
    interiorBounds: { w: 400, h: 300 },
    interiorProps: [
      { x: -110, y: -64, w: 72, h: 28, kind: 'bench', propVariant: 'fixed-bench' },
      { x: 100, y: -50, w: 44, h: 44, kind: 'ac-unit' },
      { x: 0, y: 70, w: 140, h: 18, kind: 'barrier', propVariant: 'fixed-bench' },
    ],
  },
  {
    id: 'antenna-hub',
    name: 'Relay Broadcast Hub',
    sign: 'BROADCAST 616',
    accent: '#38bdf8',
    footprint: { w: 180, h: 140 },
    interiorBounds: { w: 380, h: 280 },
    interiorProps: [
      { x: -90, y: -60, w: 44, h: 60, kind: 'metal-box', propVariant: 'heavy-metal' },
      { x: 90, y: 60, w: 52, h: 52, kind: 'fuse-box', propVariant: 'light-breakable' },
      { x: 0, y: -70, w: 60, h: 60, kind: 'attack-block' },
    ],
  },
  {
    id: 'catacomb-crypt',
    name: 'Ancient Stone Crypt',
    sign: 'SEPULCHER',
    accent: '#2dd4bf',
    footprint: { w: 200, h: 156 },
    interiorBounds: { w: 420, h: 320 },
    interiorProps: [
      { x: 0, y: 0, w: 64, h: 64, kind: 'metal-box', propVariant: 'heavy-metal' },
      { x: -120, y: -60, w: 48, h: 48, kind: 'flora' },
      { x: 120, y: 60, w: 48, h: 48, kind: 'crate-breakable', propVariant: 'light-breakable' },
    ],
  },
  {
    id: 'server-cluster',
    name: 'Mainframe Server Hub',
    sign: 'NODE 0x616',
    accent: '#ff2fd0',
    footprint: { w: 210, h: 150 },
    interiorBounds: { w: 440, h: 310 },
    interiorProps: [
      { x: -110, y: -60, w: 50, h: 70, kind: 'server-rack' },
      { x: -40, y: -60, w: 50, h: 70, kind: 'server-rack' },
      { x: 40, y: -60, w: 50, h: 70, kind: 'server-rack' },
      { x: 110, y: -60, w: 50, h: 70, kind: 'server-rack' },
      { x: 0, y: 70, w: 160, h: 18, kind: 'barrier', propVariant: 'fixed-bench' },
    ],
  },
  {
    id: 'harbor-office',
    name: 'Harbor Freight Office',
    sign: 'PORT AUTHORITY',
    accent: '#38bdf8',
    footprint: { w: 190, h: 144 },
    interiorBounds: { w: 390, h: 290 },
    interiorProps: [
      { x: -100, y: -60, w: 60, h: 60, kind: 'crate', propVariant: 'fixed-bench' },
      { x: 100, y: 60, w: 60, h: 60, kind: 'crate-breakable', propVariant: 'light-breakable' },
      { x: -90, y: 60, w: 48, h: 48, kind: 'barrel', propVariant: 'light-breakable' },
    ],
  },
  {
    id: 'toll-plaza',
    name: 'Highway Toll Station',
    sign: 'STOP - 616 TOLL',
    accent: '#f97316',
    footprint: { w: 204, h: 144 },
    interiorBounds: { w: 410, h: 290 },
    interiorProps: [
      { x: -110, y: -60, w: 80, h: 24, kind: 'barrier', propVariant: 'fixed-bench' },
      { x: 100, y: 60, w: 54, h: 54, kind: 'metal-box', propVariant: 'heavy-metal' },
      { x: 0, y: 70, w: 48, h: 48, kind: 'fuse-box', propVariant: 'light-breakable' },
    ],
  },
  {
    id: 'lev-substation',
    name: 'Lev Power Grid Substation',
    sign: 'LEV 500kV // GRID',
    accent: '#38bdf8',
    footprint: { w: 220, h: 160 },
    interiorBounds: { w: 460, h: 320 },
    interiorProps: [
      { x: -110, y: -60, w: 64, h: 54, kind: 'transformer-station', propVariant: 'heavy-metal' },
      { x: 110, y: -60, w: 64, h: 54, kind: 'transformer-station', propVariant: 'heavy-metal' },
      { x: 0, y: -80, w: 80, h: 24, kind: 'security-gate', propVariant: 'heavy-metal' },
      { x: -50, y: 60, w: 48, h: 48, kind: 'fuse-box', propVariant: 'light-breakable' },
      { x: 50, y: 60, w: 48, h: 48, kind: 'fuse-box', propVariant: 'light-breakable' },
    ],
  },
  {
    id: 'skyline-spire',
    name: 'Lev Skyline Spire',
    sign: 'SKYWAY TOWER 616',
    accent: '#f59e0b',
    footprint: { w: 240, h: 170 },
    interiorBounds: { w: 480, h: 340 },
    interiorProps: [
      { x: 0, y: -90, w: 100, h: 60, kind: 'skyscraper', propVariant: 'heavy-metal' },
      { x: -120, y: 0, w: 90, h: 32, kind: 'skyline-bridge', propVariant: 'heavy-metal' },
      { x: 120, y: 0, w: 90, h: 32, kind: 'skyline-bridge', propVariant: 'heavy-metal' },
      { x: 0, y: 80, w: 120, h: 20, kind: 'barrier', propVariant: 'fixed-bench' },
    ],
  },
  {
    id: 'nanite-foundry',
    name: 'Lev Nanite Foundry',
    sign: 'SYNTHESIS // LAB 04',
    accent: '#c084fc',
    footprint: { w: 210, h: 155 },
    interiorBounds: { w: 440, h: 310 },
    interiorProps: [
      { x: 0, y: -70, w: 50, h: 50, kind: 'beacon-tower', propVariant: 'heavy-metal' },
      { x: -110, y: 30, w: 56, h: 56, kind: 'bunker-hatch', propVariant: 'heavy-metal' },
      { x: 110, y: 30, w: 56, h: 56, kind: 'bunker-hatch', propVariant: 'heavy-metal' },
      { x: 0, y: 70, w: 54, h: 54, kind: 'metal-box', propVariant: 'heavy-metal' },
    ],
  },
];

const BUILDING_PREFABS_BY_ID = Object.fromEntries(
  BUILDING_PREFABS.map((prefab) => [prefab.id, prefab]),
) as Record<BuildingPrefabId, BuildingPrefab>;

export const THEME_DISTRICTS: Record<string, Array<{ name: string; accent: string }>> = {
  streets: [
    { name: 'Downtown Core', accent: '#ff8bd8' },
    { name: 'Westside Row', accent: '#a7f3d0' },
    { name: 'River Market', accent: '#4de1ff' },
    { name: 'Rail Cut', accent: '#ffd166' },
    { name: 'Warehouse Belt', accent: '#fb923c' },
    { name: 'Uptown Blocks', accent: '#c084fc' },
  ],
  rooftops: [
    { name: 'Penthouse Terraces', accent: '#c084fc' },
    { name: 'Neon Spire Walk', accent: '#38bdf8' },
    { name: 'Highline Grid', accent: '#a7f3d0' },
    { name: 'Broadcast Array', accent: '#facc15' },
    { name: 'Zeppelin Slip', accent: '#fb7185' },
    { name: 'Stratosphere Deck', accent: '#22d3ee' },
  ],
  catacombs: [
    { name: 'Resonance Caverns', accent: '#34d399' },
    { name: 'Sunken Sepulchers', accent: '#2dd4bf' },
    { name: 'Crystal Grotto', accent: '#00f2fe' },
    { name: 'Abyssal Verge', accent: '#818cf8' },
    { name: 'Bedrock Sanctuary', accent: '#f43f5e' },
    { name: 'Luminescent Hollow', accent: '#a7f3d0' },
  ],
  alleys: [
    { name: 'Fulton Backdoor Row', accent: '#4de1ff' },
    { name: 'Dumpster Labyrinth', accent: '#a3e635' },
    { name: 'Iron Chute Cut', accent: '#f97316' },
    { name: 'Fire-Escape Maze', accent: '#f43f5e' },
    { name: 'Steam Passage', accent: '#ffd166' },
    { name: 'Slum Central Core', accent: '#c084fc' },
  ],
  'null-sector': [
    { name: 'Node 0x00 Sub-Floor', accent: '#38bdf8' },
    { name: 'Logic Conduit Line', accent: '#22d3ee' },
    { name: 'Thermal Rack Array', accent: '#f59e0b' },
    { name: 'Memory Cascade', accent: '#ec4899' },
    { name: 'Kernel Basin', accent: '#a855f7' },
    { name: 'Overclocked Ring', accent: '#ff2fd0' },
  ],
  docks: [
    { name: 'Wharf Boardwalks', accent: '#2dd4bf' },
    { name: 'Shipping Container Slip', accent: '#f59e0b' },
    { name: 'Gantry Crane Basin', accent: '#38bdf8' },
    { name: 'Deep Fog Channel', accent: '#94a3b8' },
    { name: 'Ghost Fleet Sound', accent: '#34d399' },
    { name: 'Port Authority Reach', accent: '#4de1ff' },
  ],
  wasteland: [
    { name: 'Interstate On-Ramp', accent: '#fb923c' },
    { name: 'Gridlock Graveyard', accent: '#facc15' },
    { name: 'Collapsed Viaduct', accent: '#ef4444' },
    { name: 'Dust Storm Choke', accent: '#e2e8f0' },
    { name: 'Ruined Horizon', accent: '#a855f7' },
    { name: 'Checkpoint Verge', accent: '#f97316' },
  ],
};

const DISTRICTS = THEME_DISTRICTS.streets!;

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

function getThemeLandmark(hasBridge: boolean, variant: ChunkVariant, blockKind: BlockKind, themeId: string): ChunkLandmark | undefined {
  if (hasBridge) {
    if (themeId === 'rooftops') return { name: 'Suspended Sky Bridge', kind: 'bridge', accent: '#38bdf8' };
    if (themeId === 'catacombs') return { name: 'Ancient Arch Span', kind: 'bridge', accent: '#00f2fe' };
    if (themeId === 'null-sector') return { name: 'Data Conduit Bridge', kind: 'bridge', accent: '#22d3ee' };
    if (themeId === 'docks') return { name: 'Grand River Canal Bridge', kind: 'bridge', accent: '#2dd4bf' };
    if (themeId === 'alleys') return { name: 'Elevated Catwalk Crossing', kind: 'bridge', accent: '#4de1ff' };
    if (themeId === 'wasteland') return { name: 'Overpass Concrete Span', kind: 'bridge', accent: '#f97316' };
    return { name: 'Northline Bridge', kind: 'bridge', accent: '#4de1ff' };
  }
  if (themeId === 'rooftops') {
    if (variant === 'market') return { name: 'Sky Lounge Market', kind: 'market', accent: '#ff8bd8' };
    if (variant === 'rail') return { name: 'Cable Car Terminal', kind: 'rail-yard', accent: '#ffd166' };
    if (variant === 'plaza' || blockKind === 'park') return { name: 'Rooftop Helipad', kind: 'plaza', accent: '#a7f3d0' };
    if (variant === 'scrapyard') return { name: 'Antenna Array Mast', kind: 'scrapyard', accent: '#38bdf8' };
    if (variant === 'overpass') return { name: 'Suspended Catwalk', kind: 'overpass', accent: '#c084fc' };
  } else if (themeId === 'catacombs') {
    if (variant === 'market') return { name: 'Cavern Relic Bazaar', kind: 'market', accent: '#34d399' };
    if (variant === 'rail') return { name: 'Sub-Mine Ore Track', kind: 'rail-yard', accent: '#ffd166' };
    if (variant === 'plaza' || blockKind === 'park') return { name: 'Pillar Sanctuary', kind: 'plaza', accent: '#00f2fe' };
    if (variant === 'scrapyard') return { name: 'Obsidian Monolith', kind: 'scrapyard', accent: '#818cf8' };
    if (variant === 'overpass') return { name: 'Natural Rock Vault', kind: 'overpass', accent: '#2dd4bf' };
  } else if (themeId === 'null-sector') {
    if (variant === 'market') return { name: 'Packet Exchange Hub', kind: 'market', accent: '#1fe6ff' };
    if (variant === 'rail') return { name: 'High-Speed Bus Line', kind: 'rail-yard', accent: '#f59e0b' };
    if (variant === 'plaza' || blockKind === 'park') return { name: 'Central Mainframe Plaza', kind: 'plaza', accent: '#ff2fd0' };
    if (variant === 'scrapyard') return { name: 'Melted Core Dump', kind: 'scrapyard', accent: '#ec4899' };
    if (variant === 'overpass') return { name: 'Bus Cable Overhead', kind: 'overpass', accent: '#a855f7' };
  } else if (themeId === 'docks') {
    if (variant === 'market') return { name: 'Wharf Fish Market', kind: 'market', accent: '#2dd4bf' };
    if (variant === 'rail') return { name: 'Freight Slip Spur', kind: 'rail-yard', accent: '#ffd166' };
    if (variant === 'plaza' || blockKind === 'park') return { name: 'Harbor Promenade', kind: 'plaza', accent: '#38bdf8' };
    if (variant === 'scrapyard') return { name: 'Rusted Hull Yard', kind: 'scrapyard', accent: '#f59e0b' };
    if (variant === 'overpass') return { name: 'Gantry Overhead Crane', kind: 'overpass', accent: '#64748b' };
  } else if (themeId === 'alleys') {
    if (variant === 'market') return { name: 'Black Market Row', kind: 'market', accent: '#ff8bd8' };
    if (variant === 'rail') return { name: 'Loading Dock Spur', kind: 'rail-yard', accent: '#ffd166' };
    if (variant === 'plaza' || blockKind === 'park') return { name: 'Tenement Courtyard', kind: 'plaza', accent: '#4de1ff' };
    if (variant === 'scrapyard') return { name: 'Dumpster Compactor Row', kind: 'scrapyard', accent: '#a3e635' };
    if (variant === 'overpass') return { name: 'Fire Escape Chute', kind: 'overpass', accent: '#f97316' };
  } else if (themeId === 'wasteland') {
    if (variant === 'market') return { name: 'Scavenger Waystation', kind: 'market', accent: '#fb923c' };
    if (variant === 'rail') return { name: 'Derailment Depot', kind: 'rail-yard', accent: '#ef4444' };
    if (variant === 'plaza' || blockKind === 'park') return { name: 'Toll Plaza Ruins', kind: 'plaza', accent: '#facc15' };
    if (variant === 'scrapyard') return { name: 'Vehicle Pileup Dune', kind: 'scrapyard', accent: '#f97316' };
    if (variant === 'overpass') return { name: 'Collapsed Flyover Deck', kind: 'overpass', accent: '#e2e8f0' };
  } else {
    if (variant === 'market') return { name: 'Night Market', kind: 'market', accent: '#ff8bd8' };
    if (variant === 'rail') return { name: 'East Yard', kind: 'rail-yard', accent: '#ffd166' };
    if (variant === 'plaza' || blockKind === 'park') return { name: 'Civic Plaza', kind: 'plaza', accent: '#a7f3d0' };
    if (variant === 'scrapyard') return { name: 'Salvage Row', kind: 'scrapyard', accent: '#fb923c' };
    if (variant === 'overpass') return { name: 'Overpass Underlot', kind: 'overpass', accent: '#94a3b8' };
  }
  return undefined;
}

/**
 * Generate a single chunk. The run seed is mixed with the chunk
 * position so the output is stable but varies across the world.
 */
export function generateChunk(cx: number, cy: number, runSeed: number, themeId: string = 'streets'): StreetChunk {
  // Mix seed with position using primes so small deltas give big bit changes.
  const mixedSeed = (runSeed ^ (cx * 73856093)) ^ (cy * 19349663);
  const rng = createRng(mixedSeed >>> 0);
  const band = endlessBandForChunk(cx, cy, CHUNK_SIZE, themeId);

  const variantIndex = Math.floor(rng() * VARIANTS.length);
  const variant = VARIANTS[variantIndex] ?? 'strip';

  // A river/canal is a persistent horizontal band. Only every fourth block on the
  // band has a bridge; the other blocks are river edges and stay impassable.
  const riverFrequency = themeId === 'docks' ? 4 : 6;
  const isOuterBoundary = band.thresholdPx >= 6000;
  const hasRiver = !isOuterBoundary && cy !== 0 && ((cy % riverFrequency) + riverFrequency) % riverFrequency === (themeId === 'docks' ? 2 : 3);
  const hasBridge = hasRiver && ((cx % 4) + 4) % 4 === 0;
  const riverCrossingX = hasBridge ? 0 : null;
  const blockKind = hasRiver
    ? (hasBridge ? 'bridge' : 'river-edge')
    : BLOCK_KINDS[(variantIndex + Math.abs(cx) + Math.abs(cy)) % BLOCK_KINDS.length]!;

  const landmark: ChunkLandmark | undefined = getThemeLandmark(hasBridge, variant, blockKind, themeId);

  const obstacles: ObstacleDef[] = [];
  const currentDistricts = THEME_DISTRICTS[themeId] ?? THEME_DISTRICTS.streets!;
  const districtInfo = hasRiver
    ? currentDistricts[2]!
    : currentDistricts[(Math.abs(cx * 3 + cy * 5) + variantIndex) % currentDistricts.length]!;

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

  const themePrefabPools: Record<string, BuildingPrefabId[]> = {
    rooftops: ['penthouse', 'antenna-hub', 'clinic', 'bar'],
    catacombs: ['catacomb-crypt', 'warehouse'],
    'null-sector': ['server-cluster', 'laundromat'],
    docks: ['harbor-office', 'warehouse', 'bar', 'corner-store'],
    alleys: ['apartment', 'bar', 'auto-shop', 'corner-store'],
    wasteland: ['toll-plaza', 'auto-shop', 'warehouse'],
  };

  const prefabPool = isOuterBoundary
    ? [] as BuildingPrefabId[]
    : (themePrefabPools[themeId] ?? prefabPools[blockKind]);
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
  } else if (variant === 'alley' || variant === 'scrapyard') {
    obstacles.push({ x: -188, y: 0, w: 18, h: 250, kind: 'barrier' });
  } else if (variant === 'overpass') {
    for (const x of [-150, 150]) {
      obstacles.push({ x, y: 0, w: 34, h: 260, kind: 'metal-box' });
    }
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
    scrapyard: [5, 9],
    overpass: [3, 6],
  };
  const [minProps, maxProps] = propCounts[variant];
  const bandPropBonus = band.id === 'industrial-fringe' || band.id === 'outer-threshold' ? 2 : 0;
  const propCount = minProps + bandPropBonus + Math.floor(rng() * (maxProps - minProps + 1));

  // Trailing 4 weights on every row are [trash-can, mailbox, fire-hydrant, parking-meter] —
  // the endless-mode street-prop set, skewed toward alley/market/strip/parking variants.
  const kindWeights: Record<ChunkVariant, number[]> = {
    // strip: lots of cars, some planters
    strip: [4, 1, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 1, 1, 3],
    // alley: dumpsters and crates
    alley: [1, 3, 4, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 4, 1, 2, 0],
    // parking: mostly cars
    parking: [6, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 0, 1, 5],
    // lot: mixed
     lot: [1, 2, 3, 2, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 3, 2, 1, 2, 2, 2, 2],
    // market: stalls, barriers, signs
     market: [1, 1, 3, 2, 4, 0, 3, 1, 1, 1, 0, 2, 2, 1, 3, 1, 2, 3, 2, 2, 1],
    // rail: long barriers, wrecks and signal boxes
     rail: [1, 0, 1, 0, 5, 1, 0, 1, 3, 2, 4, 1, 3, 2, 2, 3, 1, 0, 0, 0, 0],
    // plaza: open lanes with lamps and planters
     plaza: [0, 0, 1, 5, 3, 0, 1, 0, 1, 4, 0, 1, 2, 1, 4, 1, 3, 2, 1, 1, 0],
    // scrapyard: car wrecks, dumpsters, and stacked scrap metal
     scrapyard: [2, 4, 2, 0, 2, 1, 0, 4, 1, 1, 6, 3, 2, 1, 1, 5, 0, 2, 0, 0, 0],
    // overpass: support pillars, cover, and rain-slick reflective ground
     overpass: [1, 1, 1, 0, 6, 0, 0, 1, 2, 3, 1, 1, 5, 4, 0, 2, 1, 2, 0, 1, 0],
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
    if (themeId === 'rooftops') {
      if (kind === 'car' || kind === 'mailbox' || kind === 'fire-hydrant') kind = 'ac-unit';
      if (kind === 'dumpster') kind = 'neon-sign';
      if (kind === 'parking-meter') kind = 'reflective-surface';
    } else if (themeId === 'catacombs') {
      if (kind === 'car' || kind === 'dumpster' || kind === 'parking-meter' || kind === 'mailbox') kind = 'metal-box';
      if (kind === 'fire-hydrant' || kind === 'street-lamp') kind = 'flora';
      if (kind === 'neon-sign') kind = 'attack-block';
    } else if (themeId === 'null-sector') {
      if (kind === 'car' || kind === 'dumpster' || kind === 'mailbox' || kind === 'planter') kind = 'server-rack';
      if (kind === 'parking-meter' || kind === 'fire-hydrant') kind = 'ac-unit';
    } else if (themeId === 'docks') {
      if (kind === 'car') kind = 'crate-breakable';
      if (kind === 'mailbox') kind = 'barrel';
      if (kind === 'parking-meter') kind = 'metal-box';
    } else if (themeId === 'wasteland') {
      if (kind === 'planter' || kind === 'mailbox' || kind === 'street-lamp') kind = 'car-wreck';
      if (kind === 'parking-meter') kind = 'pothole';
    } else if (themeId === 'alleys') {
      if (kind === 'car') kind = 'dumpster';
      if (kind === 'planter') kind = 'trash-can';
    }

    if (band.id.endsWith('-rail') && i % 3 === 0) kind = 'barrier';
    if (band.id.endsWith('-fringe') && i % 3 === 0) kind = 'metal-box';
    if (band.id.endsWith('-threshold') && i % 2 === 0) kind = 'reflective-surface';
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
      'trash-can': [30, 42, 34, 46],
      mailbox: [26, 34, 50, 64],
      'fire-hydrant': [26, 34, 30, 38],
      'parking-meter': [14, 20, 46, 58],
      'attack-block': [50, 70, 50, 70],
      'server-rack': [46, 60, 56, 84],
      'tree-digital': [50, 80, 50, 80],
      'tree-fake': [50, 80, 50, 80],
      skyscraper: [140, 220, 120, 180],
      'transformer-station': [64, 96, 50, 70],
      'skyline-bridge': [120, 180, 32, 48],
      'beacon-tower': [44, 60, 44, 60],
      'security-gate': [70, 110, 24, 32],
      'bunker-hatch': [50, 68, 50, 68],
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
