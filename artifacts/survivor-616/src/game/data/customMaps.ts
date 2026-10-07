import { AREAS } from '@/game/data/areas';
import { ENEMIES } from '@/game/data/enemies';
import { expandMapPrefab, MAP_PACK_ASSETS, MAP_PREFABS, MAP_PROP_ART_BY_ID, type MapPrefab } from './mapPack';
import type {
  AreaDef,
  CustomMap,
  CustomMapAsset,
  CustomMapPlacement,
  ObstacleDef,
  WaveDef,
} from '@/game/types';

export const MAX_CUSTOM_MAPS = 12;
export const MAX_CUSTOM_MAP_PLACEMENTS = 300;
export const CUSTOM_MAP_GRID = 20;
export const CUSTOM_MAP_MIN_BOUNDS = { w: 480, h: 360 };
export const CUSTOM_MAP_MAX_BOUNDS = { w: 3200, h: 2600 };

const GROUND_ASSETS: CustomMapAsset[] = AREAS
  .filter((area) => !area.endless)
  .map((area) => ({
    id: `ground:${area.id}`,
    category: 'ground',
    name: area.name,
    description: `${area.district} · ${area.ground.glow} street palette`,
    color: area.ground.glow,
    areaId: area.id,
  }));

const TILE_ASSETS: CustomMapAsset[] = AREAS
  .filter((area) => !area.endless)
  .filter((area, index, list) => list.findIndex((candidate) =>
    candidate.ground.base === area.ground.base &&
    candidate.ground.tile === area.ground.tile &&
    candidate.ground.seam === area.ground.seam &&
    candidate.ground.glow === area.ground.glow,
  ) === index)
  .map((area) => ({
    id: `tile:${area.id}`,
    category: 'tile',
    name: `${area.name} tile`,
    description: `Paint one 64-unit cell with ${area.district}'s complete ground treatment.`,
    color: area.ground.glow,
    areaId: area.id,
    groundStyle: { ...area.ground },
    w: 64,
    h: 64,
  }));

for (const area of AREAS) for (const [index, tile] of (area.authoredGroundTiles ?? []).entries()) {
  if (TILE_ASSETS.some((asset) => asset.groundStyle?.base === tile.base && asset.groundStyle?.tile === tile.tile)) continue;
  TILE_ASSETS.push({ id: `tile-authored:${area.id}:${index}`, category: 'tile', name: `${area.name} zone ${index + 1}`, description: 'Paint this authored zone treatment.', color: tile.glow, groundStyle: { base: tile.base, tile: tile.tile, seam: tile.seam, glow: tile.glow }, w: 64, h: 64 });
}

const STRUCTURE_KINDS: Array<ObstacleDef['kind']> = Array.from(new Set(
  AREAS.flatMap((area) => area.obstacles)
    .map((obstacle) => obstacle.kind)
    .filter((kind) => kind !== 'pothole' && kind !== 'map-prop'),
));

const STRUCTURE_LABELS: Partial<Record<ObstacleDef['kind'], string>> = {
  'ac-unit': 'A/C unit',
  'neon-sign': 'Neon sign',
  'fuse-box': 'Fuse box',
  'street-lamp': 'Street lamp',
  'car-wreck': 'Car wreck',
  'crate-breakable': 'Breakable crate',
  'security-camera': 'Security camera',
  'reflective-surface': 'Reflective cover',
  'metal-box': 'Metal box',
};

const STRUCTURE_COLORS: Partial<Record<ObstacleDef['kind'], string>> = {
  car: '#60a5fa',
  dumpster: '#22c55e',
  crate: '#f59e0b',
  planter: '#4ade80',
  barrier: '#f97316',
  'ac-unit': '#cbd5e1',
  'neon-sign': '#f472b6',
  barrel: '#fb923c',
  'fuse-box': '#facc15',
  'street-lamp': '#fde68a',
  'car-wreck': '#94a3b8',
  'crate-breakable': '#fbbf24',
  'security-camera': '#e879f9',
  cover: '#38bdf8',
  'reflective-surface': '#67e8f9',
  flora: '#34d399',
  building: '#a78bfa',
  'metal-box': '#64748b',
  bench: '#d97706',
};

const firstObstacleForKind = (kind: ObstacleDef['kind']): ObstacleDef | undefined =>
  AREAS.flatMap((area) => area.obstacles).find((obstacle) => obstacle.kind === kind);

const STRUCTURE_ASSETS: CustomMapAsset[] = STRUCTURE_KINDS.map((kind) => {
  const sample = firstObstacleForKind(kind);
  return {
    id: `structure:${kind}`,
    category: 'structure',
    name: STRUCTURE_LABELS[kind] ?? kind.replaceAll('-', ' '),
    description: 'Existing city prop with authored collision behavior.',
    color: STRUCTURE_COLORS[kind] ?? '#94a3b8',
    w: sample?.w ?? 60,
    h: sample?.h ?? 60,
  };
});

const HAZARD_ASSETS: CustomMapAsset[] = [
  {
    id: 'hazard:pothole-stomp',
    category: 'hazard',
    name: 'Stomp pothole',
    description: 'A warning pit that opens when the player lands hard.',
    color: '#f97316',
    w: 70,
    h: 54,
  },
  {
    id: 'hazard:pothole-shock',
    category: 'hazard',
    name: 'Shock pothole',
    description: 'A warning pit that responds to ground-shock attacks.',
    color: '#ef4444',
    w: 70,
    h: 54,
  },
];

const LANDMARK_ASSETS: CustomMapAsset[] = AREAS
  .filter((area) => area.landmark)
  .map((area) => ({
    id: `landmark:${area.id}`,
    category: 'landmark',
    name: area.landmark!.name,
    description: area.landmark!.description,
    color: area.landmark!.accent,
    areaId: area.id,
  }));

const ENEMY_ASSETS: CustomMapAsset[] = ENEMIES.map((enemy) => ({
  id: `enemy:${enemy.id}`,
  category: 'enemy',
  name: enemy.name,
  description: `${enemy.family} · ${enemy.behavior}`,
  color: enemy.palette.accent,
  w: enemy.radius * 2,
  h: enemy.radius * 2,
  enemyId: enemy.id,
}));

const ENCOUNTER_ASSETS: CustomMapAsset[] = ENEMIES.map((enemy) => ({
  id: `encounter:${enemy.id}`,
  category: 'encounter',
  name: `${enemy.name} wave`,
  description: `A steady encounter built around ${enemy.name}.`,
  color: enemy.palette.glow,
  enemyId: enemy.id,
  wave: {
    fromSec: 0,
    toSec: 120,
    enemyId: enemy.id,
    ratePerSec: 0.65,
    burst: 1,
  },
}));

/**
 * Spawn points and objective markers are *metadata*, not world geometry --
 * `customMapToArea` deliberately skips them so they never become obstacles or
 * waves. Sector Command missions read them off the map to decide where the
 * player starts, where hostiles enter, and what an objective points at.
 */
const SPAWN_POINT_ASSETS: CustomMapAsset[] = [
  { id: 'spawn-point:player', category: 'spawn-point', name: 'Player start', description: 'Where the run begins. Only the first one placed is used.', color: '#4ade80', w: 48, h: 48, spawnSide: 'player' },
  { id: 'spawn-point:hostile', category: 'spawn-point', name: 'Hostile entry', description: 'A lane hostiles walk in from. Place several to spread pressure.', color: '#f87171', w: 48, h: 48, spawnSide: 'hostile' },
];

const OBJECTIVE_MARKER_ASSETS: CustomMapAsset[] = [
  { id: 'objective-marker:hold', category: 'objective-marker', name: 'Hold point', description: 'Stand here to make progress on a hold objective.', color: '#fbbf24', w: 64, h: 64, markerRole: 'hold' },
  { id: 'objective-marker:destroy', category: 'objective-marker', name: 'Demolition target', description: 'A prop a mission can ask you to break.', color: '#fb7185', w: 56, h: 56, markerRole: 'destroy' },
  { id: 'objective-marker:escort', category: 'objective-marker', name: 'Escort waypoint', description: 'A point an escorted unit routes through.', color: '#38bdf8', w: 56, h: 56, markerRole: 'escort' },
  { id: 'objective-marker:extract', category: 'objective-marker', name: 'Extraction', description: 'Reach this to finish an extraction objective.', color: '#a78bfa', w: 64, h: 64, markerRole: 'extract' },
];

/** Tier 2 economy: one entry per `SectorStructureDef`, so a map can place them. */
export const BEACON_ASSETS: CustomMapAsset[] = [
  { id: 'beacon:relay-beacon', category: 'beacon', name: 'Choir Relay', description: 'Trickles a light unit every 12s while it stands. Never exceeds the squad cap.', color: '#facc15', w: 56, h: 56, beaconId: 'relay-beacon' },
  { id: 'beacon:repeater-beacon', category: 'beacon', name: 'Null Repeater', description: 'Slower reinforcements, sturdier body.', color: '#38bdf8', w: 56, h: 56, beaconId: 'repeater-beacon' },
];

const PICKUP_ASSETS: CustomMapAsset[] = [
  { id: 'pickup:health', category: 'pickup', name: 'Health kit', description: 'A one-time field heal.', color: '#4ade80', w: 28, h: 28, pickupKind: 'health' },
  { id: 'pickup:cred', category: 'pickup', name: 'Cred stash', description: 'A small placed cache of cred.', color: '#fbbf24', w: 28, h: 28, pickupKind: 'cred' },
  { id: 'pickup:cyber-resin', category: 'pickup', name: 'Cyber resin', description: 'Null crafting material.', color: '#c084fc', w: 28, h: 28, pickupKind: 'cyber-resin' },
  { id: 'pickup:rootglass-cell', category: 'pickup', name: 'Rootglass cell', description: 'Temporary weapon cooldown boost.', color: '#5eead4', w: 30, h: 30, pickupKind: 'rootglass-cell' },
];

const INTERACTABLE_ASSETS: CustomMapAsset[] = [
  { id: 'interactable:relay', category: 'interactable', name: 'Relay console', description: 'Activate nearby to restore lighting and open a route.', color: '#fbbf24', w: 70, h: 68, interactableKind: 'relay' },
  { id: 'interactable:root-anchor', category: 'interactable', name: 'Root anchor', description: 'Destroy this living node to quiet nearby spores.', color: '#34d399', w: 70, h: 70, interactableKind: 'root-anchor' },
  { id: 'interactable:cache', category: 'interactable', name: 'Transit cache', description: 'Open once for supplies.', color: '#f59e0b', w: 76, h: 62, interactableKind: 'cache' },
  { id: 'interactable:plate', category: 'interactable', name: '616 Plate', description: 'A hidden world find that unlocks the Breach 616 theme.', color: '#fcd34d', w: 48, h: 48, interactableKind: 'plate' },
  { id: 'interactable:coil', category: 'interactable', name: 'Transit Coil', description: 'Find the Catenary Harpoon.', color: '#67e8f9', w: 48, h: 48, interactableKind: 'coil' },
];

const AMBIANCE_ASSETS: CustomMapAsset[] = [
  { id: 'ambiance:street-rain', category: 'ambiance', name: 'Street rain', description: 'Rain, wet sheen and steam.', color: '#60a5fa' },
  { id: 'ambiance:null-spores', category: 'ambiance', name: 'Null spores', description: 'Roofed grove with drifting spores.', color: '#34d399' },
  { id: 'ambiance:breach', category: 'ambiance', name: 'Breach weather', description: 'Rain with Null-lit particles.', color: '#5eead4' },
  { id: 'ambiance:clear', category: 'ambiance', name: 'Clear night', description: 'Dry sky and restrained glow.', color: '#fbbf24' },
];

export const CUSTOM_MAP_ASSETS: CustomMapAsset[] = [
  ...GROUND_ASSETS,
  ...TILE_ASSETS,
  ...STRUCTURE_ASSETS,
  ...MAP_PACK_ASSETS,
  ...HAZARD_ASSETS,
  ...LANDMARK_ASSETS,
  ...ENEMY_ASSETS,
  ...ENCOUNTER_ASSETS,
  ...SPAWN_POINT_ASSETS,
  ...OBJECTIVE_MARKER_ASSETS,
  ...BEACON_ASSETS,
  ...PICKUP_ASSETS,
  ...INTERACTABLE_ASSETS,
  ...AMBIANCE_ASSETS,
];

export const CUSTOM_MAP_ASSETS_BY_ID: Record<string, CustomMapAsset> = Object.fromEntries(
  CUSTOM_MAP_ASSETS.map((asset) => [asset.id, asset]),
);

export const CUSTOM_MAP_ASSET_CATEGORIES = [
  { id: 'ground', label: 'Ground styles' },
  { id: 'tile', label: 'Paintable ground tiles' },
  { id: 'beacon', label: 'Reinforcement beacons' },
  { id: 'structure', label: 'Structures & props' },
  { id: 'hazard', label: 'Hazards' },
  { id: 'landmark', label: 'Landmarks' },
  { id: 'enemy', label: 'Enemies' },
  { id: 'encounter', label: 'Encounters & waves' },
  { id: 'spawn-point', label: 'Spawn points' },
  { id: 'objective-marker', label: 'Objective markers' },
  { id: 'pickup', label: 'Items & supplies' },
  { id: 'interactable', label: 'Interactables' },
  { id: 'ambiance', label: 'Ambiance presets' },
] as const;

/** Sector Command reads these off an authored map; they are never world geometry. */
export function spawnPointsOf(map: CustomMap, side: 'player' | 'hostile'): CustomMapPlacement[] {
  return map.placements.filter((placement) => {
    if (placement.category !== 'spawn-point') return false;
    return assetFromId(placement.assetId)?.spawnSide === side;
  });
}

/** Sector Command reads beacon placements off an authored map; never world geometry. */
export function beaconsOf(map: CustomMap): CustomMapPlacement[] {
  return map.placements.filter((placement) => placement.category === 'beacon');
}

export function objectiveMarkersOf(map: CustomMap, role?: NonNullable<CustomMapAsset['markerRole']>): CustomMapPlacement[] {
  return map.placements.filter((placement) => {
    if (placement.category !== 'objective-marker') return false;
    if (!role) return true;
    return assetFromId(placement.assetId)?.markerRole === role;
  });
}

export function assetFromId(assetId: string): CustomMapAsset | undefined {
  return CUSTOM_MAP_ASSETS_BY_ID[assetId];
}

export function createCustomMap(id = `custom-${Date.now().toString(36)}`): CustomMap {
  const ground = GROUND_ASSETS[0]!;
  return {
    version: 2,
    id,
    name: 'New night route',
    bounds: { ...CUSTOM_MAP_MIN_BOUNDS },
    groundAssetId: ground.id,
    landmarkAssetId: null,
    placements: [],
    durationSec: 120,
    threat: 'rising',
    backdrop: AREAS.find((area) => area.id === ground.areaId)?.backdrop ?? 'art/street.jpeg',
    sky: 'clear',
    ambiance: 'clear',
    updatedAt: Date.now(),
  };
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  return Math.round(Math.min(max, Math.max(min, finite(value, fallback))));
}

/**
 * Derived from the catalog on purpose. This used to be a hand-written list,
 * and it silently omitted `spawn-point` and `objective-marker` when those
 * categories were added -- so the editor could place them but `saveCustomMap`
 * (which normalises) dropped them on the way to storage. Deriving it means a
 * new category can never be forgotten here again.
 */
const PLACEABLE_CATEGORIES = new Set<string>(
  CUSTOM_MAP_ASSET_CATEGORIES.map((category) => category.id).filter((id) => id !== 'ground'),
);

function validCategory(value: unknown): CustomMapPlacement['category'] | null {
  return typeof value === 'string' && PLACEABLE_CATEGORIES.has(value)
    ? (value as CustomMapPlacement['category'])
    : null;
}

export function normalizeCustomMap(value: unknown, fallbackId = `custom-${Date.now().toString(36)}`): CustomMap | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<CustomMap>;
  const id = typeof raw.id === 'string' && /^custom-[a-z0-9-]+$/i.test(raw.id) ? raw.id : fallbackId;
  const rawBounds = raw.bounds && typeof raw.bounds === 'object' ? raw.bounds : {};
  const bounds = {
    w: clampInt((rawBounds as { w?: unknown }).w, CUSTOM_MAP_MIN_BOUNDS.w, CUSTOM_MAP_MAX_BOUNDS.w, CUSTOM_MAP_MIN_BOUNDS.w),
    h: clampInt((rawBounds as { h?: unknown }).h, CUSTOM_MAP_MIN_BOUNDS.h, CUSTOM_MAP_MAX_BOUNDS.h, CUSTOM_MAP_MIN_BOUNDS.h),
  };
  const ground = assetFromId(typeof raw.groundAssetId === 'string' ? raw.groundAssetId : '');
  const fallback = createCustomMap(id);
  const placements: CustomMapPlacement[] = [];
  if (Array.isArray(raw.placements)) {
    for (const candidate of raw.placements.slice(0, MAX_CUSTOM_MAP_PLACEMENTS)) {
      if (!candidate || typeof candidate !== 'object') continue;
      const item = candidate as Partial<CustomMapPlacement>;
      const asset = typeof item.assetId === 'string' ? assetFromId(item.assetId) : undefined;
      const category = validCategory(item.category);
      if (!asset || !category || asset.category !== category) continue;
      const w = clampInt(item.w, 12, category === 'tile' ? bounds.w : 360, asset.w ?? 60);
      const h = clampInt(item.h, 12, category === 'tile' ? bounds.h : 360, asset.h ?? 60);
      placements.push({
        id: typeof item.id === 'string' ? item.id.slice(0, 64) : `placement-${placements.length + 1}`,
        assetId: asset.id,
        category,
        x: clampInt(item.x, -bounds.w / 2 + w / 2, bounds.w / 2 - w / 2, 0),
        y: clampInt(item.y, -bounds.h / 2 + h / 2, bounds.h / 2 - h / 2, 0),
        w,
        h,
        ...(asset.artAssetId ? { mode: MAP_PROP_ART_BY_ID[asset.artAssetId]?.modes.includes(item.mode ?? 'breakable') ? item.mode : asset.defaultMode } : {}),
        ...(typeof item.groupId === 'string' && item.groupId.length <= 64 ? { groupId: item.groupId } : {}),
        ...(item.category === 'enemy' || item.category === 'encounter' ? {
          fromSec: clampInt(item.fromSec, 0, 599, placements.length * 8),
          toSec: clampInt(item.toSec, 1, 600, clampInt(raw.durationSec, 60, 600, 120)),
          ratePerSec: Math.max(0.05, Math.min(5, finite(item.ratePerSec, 0.65))),
          burst: clampInt(item.burst, 1, 12, 1),
        } : {}),
      });
    }
  }
  const landmarkAssetId = typeof raw.landmarkAssetId === 'string' &&
    assetFromId(raw.landmarkAssetId)?.category === 'landmark'
    ? raw.landmarkAssetId
    : null;
  const threat = raw.threat === 'low' || raw.threat === 'rising' || raw.threat === 'high' || raw.threat === 'severe'
    ? raw.threat
    : fallback.threat;
  return {
    version: 2,
    id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 48) : fallback.name,
    bounds,
    groundAssetId: ground?.category === 'ground' ? ground.id : fallback.groundAssetId,
    landmarkAssetId,
    mapFeature: raw.mapFeature === 'fractured-616' || raw.mapFeature === 'glassroot-shrine' ? raw.mapFeature : undefined,
    landmarkPosition: raw.landmarkPosition && typeof raw.landmarkPosition === 'object' ? {
      x: clampInt(raw.landmarkPosition.x, -bounds.w / 2, bounds.w / 2, 0),
      y: clampInt(raw.landmarkPosition.y, -bounds.h / 2, bounds.h / 2, -150),
    } : undefined,
    placements,
    durationSec: clampInt(raw.durationSec, 60, 600, fallback.durationSec),
    threat,
    backdrop: ground?.areaId ? (AREAS.find((area) => area.id === ground.areaId)?.backdrop ?? fallback.backdrop) : fallback.backdrop,
    sky: raw.sky === 'rain' || raw.sky === 'fog' || raw.sky === 'overcast' || raw.sky === 'roofed' || raw.sky === 'clear' ? raw.sky : fallback.sky,
    ambiance: raw.ambiance === 'street-rain' || raw.ambiance === 'null-spores' || raw.ambiance === 'breach' || raw.ambiance === 'clear' ? raw.ambiance : fallback.ambiance,
    updatedAt: Math.max(0, finite(raw.updatedAt, Date.now())),
  };
}

export function normalizeCustomMaps(value: unknown): CustomMap[] {
  if (!Array.isArray(value)) return [];
  const maps: CustomMap[] = [];
  const ids = new Set<string>();
  for (const [index, candidate] of value.slice(0, MAX_CUSTOM_MAPS).entries()) {
    const map = normalizeCustomMap(candidate, `custom-import-${index + 1}`);
    if (!map || ids.has(map.id)) continue;
    ids.add(map.id);
    maps.push(map);
  }
  return maps.sort((left, right) => right.updatedAt - left.updatedAt);
}

export function customMapValidationIssues(map: CustomMap): string[] {
  const issues: string[] = [];
  if (!map.name.trim()) issues.push('Route needs a name.');
  if (!map.placements.some((placement) => placement.category === 'enemy' || placement.category === 'encounter')) {
    issues.push('Route needs at least one enemy or encounter.');
  }
  if (map.placements.length > MAX_CUSTOM_MAP_PLACEMENTS) {
    issues.push(`Route exceeds the ${MAX_CUSTOM_MAP_PLACEMENTS}-placement limit.`);
  }
  for (const placement of map.placements) {
    const asset = assetFromId(placement.assetId);
    if (!asset || asset.category !== placement.category) { issues.push(`Unknown asset ${placement.assetId}. Replace this placement.`); continue; }
    if (Math.abs(placement.x) + placement.w / 2 > map.bounds.w / 2 || Math.abs(placement.y) + placement.h / 2 > map.bounds.h / 2) {
      issues.push(`${asset.name} at ${placement.x}, ${placement.y} crosses the map edge.`);
    }
    if (asset.artAssetId && placement.mode && !MAP_PROP_ART_BY_ID[asset.artAssetId]?.modes.includes(placement.mode)) {
      issues.push(`${asset.name} does not support ${placement.mode} behavior.`);
    }
  }
  const start = map.placements.find((placement) => placement.assetId === 'spawn-point:player');
  const solids = map.placements.filter((placement) =>
    (placement.category === 'structure' && placement.mode !== 'cosmetic') ||
    (placement.category === 'interactable' && placement.assetId === 'interactable:root-anchor'),
  );
  if (start && solids.some((solid) => Math.abs(start.x - solid.x) < solid.w / 2 + 18 && Math.abs(start.y - solid.y) < solid.h / 2 + 18)) {
    issues.push('Player start overlaps solid scenery.');
  }
  for (const entry of map.placements.filter((placement) => placement.assetId === 'spawn-point:hostile')) {
    if (solids.some((solid) => Math.abs(entry.x - solid.x) < solid.w / 2 + 18 && Math.abs(entry.y - solid.y) < solid.h / 2 + 18)) {
      issues.push('A hostile entry overlaps solid scenery.');
      break;
    }
  }
  for (const wave of map.placements.filter((placement) => placement.category === 'enemy' || placement.category === 'encounter')) {
    if ((wave.fromSec ?? 0) >= (wave.toSec ?? map.durationSec) || (wave.toSec ?? map.durationSec) > map.durationSec) {
      issues.push('An encounter has an invalid time window.');
      break;
    }
  }
  const permanent = map.placements.filter((placement) => placement.category === 'structure' && placement.mode !== 'breakable' && placement.mode !== 'cosmetic');
  const cell = 64;
  const columns = Math.ceil(map.bounds.w / cell);
  const rows = Math.ceil(map.bounds.h / cell);
  const center = (col: number, row: number) => ({ x: -map.bounds.w / 2 + (col + 0.5) * cell, y: -map.bounds.h / 2 + (row + 0.5) * cell });
  const free = (col: number, row: number) => {
    if (col < 0 || row < 0 || col >= columns || row >= rows) return false;
    const point = center(col, row);
    return !permanent.some((solid) => Math.abs(point.x - solid.x) < solid.w / 2 + 18 && Math.abs(point.y - solid.y) < solid.h / 2 + 18);
  };
  const startPoint = start ?? { x: 0, y: 0 };
  const startCol = Math.floor((startPoint.x + map.bounds.w / 2) / cell);
  const startRow = Math.floor((startPoint.y + map.bounds.h / 2) / cell);
  const visited = new Set<number>();
  const queue: Array<[number, number]> = [[startCol, startRow]];
  for (let head = 0; head < queue.length; head += 1) {
    const [col, row] = queue[head]!;
    const key = row * columns + col;
    if (visited.has(key) || !free(col, row)) continue;
    visited.add(key);
    queue.push([col + 1, row], [col - 1, row], [col, row + 1], [col, row - 1]);
  }
  for (const target of map.placements.filter((placement) => placement.category === 'interactable' || placement.category === 'objective-marker')) {
    const reachable = [...visited].some((key) => {
      const point = center(key % columns, Math.floor(key / columns));
      return Math.hypot(point.x - target.x, point.y - target.y) <= (target.category === 'interactable' ? 110 : 75);
    });
    if (!reachable) issues.push(`${assetFromId(target.assetId)?.name ?? 'Objective'} at ${target.x}, ${target.y} is blocked by permanent scenery.`);
  }
  return issues;
}

function obstacleFromPlacement(placement: CustomMapPlacement, asset: CustomMapAsset): ObstacleDef | null {
  if (placement.category === 'hazard') {
    return {
      x: placement.x,
      y: placement.y,
      w: placement.w,
      h: placement.h,
      kind: 'pothole',
      pothole: { trigger: placement.assetId.endsWith('stomp') ? 'stomp' : 'ground-shock' },
    };
  }
  if (placement.category !== 'structure') return null;
  if (asset.artAssetId) {
    if (placement.mode === 'cosmetic') return null;
    return {
      x: placement.x, y: placement.y, w: placement.w, h: placement.h,
      kind: 'map-prop', artAssetId: asset.artAssetId,
      propVariant: placement.mode === 'breakable' ? 'fixed-breakable' : 'fixed-bench',
      ...(placement.mode === 'breakable' ? { hp: 120 } : {}),
    };
  }
  const kind = asset.id.slice('structure:'.length) as ObstacleDef['kind'];
  return { x: placement.x, y: placement.y, w: placement.w, h: placement.h, kind };
}

export function customMapToArea(map: CustomMap): AreaDef {
  const normalized = normalizeCustomMap(map, map.id) ?? createCustomMap(map.id);
  const ground = assetFromId(normalized.groundAssetId);
  const sourceArea = ground?.areaId ? AREAS.find((area) => area.id === ground.areaId) : AREAS[0];
  const obstacles = normalized.placements
    .map((placement) => obstacleFromPlacement(placement, assetFromId(placement.assetId) ?? {} as CustomMapAsset))
    .filter((obstacle): obstacle is ObstacleDef => Boolean(obstacle));
  for (const anchor of normalized.placements.filter((placement) => placement.assetId === 'interactable:root-anchor')) {
    if (!obstacles.some((obstacle) => obstacle.artAssetId === 'node-pylon' && Math.abs(obstacle.x - anchor.x) < 8 && Math.abs(obstacle.y - anchor.y) < 8)) {
      obstacles.push({ x: anchor.x, y: anchor.y, w: anchor.w, h: anchor.h, kind: 'map-prop', artAssetId: 'node-pylon', hp: 120, propVariant: 'fixed-breakable' });
    }
  }
  const decorations: ObstacleDef[] = normalized.placements
    .filter((placement) => placement.category === 'structure' && placement.mode === 'cosmetic')
    .map((placement) => ({ x: placement.x, y: placement.y, w: placement.w, h: placement.h, kind: 'map-prop', artAssetId: assetFromId(placement.assetId)?.artAssetId }));
  const authoredGroundTiles = normalized.placements
    .filter((placement) => placement.category === 'tile')
    .map((placement) => {
      const style = assetFromId(placement.assetId)?.groundStyle ?? sourceArea?.ground ?? AREAS[0]!.ground;
      return { x: placement.x, y: placement.y, w: placement.w, h: placement.h, ...style };
    });
  const waves: WaveDef[] = normalized.placements
    .filter((placement) => placement.category === 'enemy' || placement.category === 'encounter')
    .map((placement, index) => {
      const asset = assetFromId(placement.assetId);
      const enemyId = asset?.enemyId ?? ENEMIES[0]!.id;
      return {
        ...(asset?.wave ?? {}),
        fromSec: placement.fromSec ?? Math.min(normalized.durationSec - 1, index * 8),
        toSec: placement.toSec ?? normalized.durationSec,
        enemyId,
        ratePerSec: placement.ratePerSec ?? asset?.wave?.ratePerSec ?? 0.65,
        burst: placement.burst ?? asset?.wave?.burst ?? 1,
        spawnAt: { x: placement.x, y: placement.y },
      };
    });
  const landmark = normalized.landmarkAssetId ? assetFromId(normalized.landmarkAssetId) : undefined;
  const landmarkSource = landmark?.areaId ? AREAS.find((area) => area.id === landmark.areaId)?.landmark : undefined;
  return {
    id: normalized.id,
    name: normalized.name,
    district: 'Custom route',
    description: 'A player-authored night route assembled in the Sanctum computer.',
    backdrop: normalized.backdrop,
    bounds: normalized.bounds,
    ground: sourceArea?.ground ?? AREAS[0]!.ground,
    obstacles,
    decorations,
    playerStart: spawnPointsOf(normalized, 'player').map((placement) => ({ x: placement.x, y: placement.y }))[0],
    hostileEntries: spawnPointsOf(normalized, 'hostile').map((placement) => ({ x: placement.x, y: placement.y })),
    mapPickups: normalized.placements.filter((placement) => placement.category === 'pickup').map((placement) => ({ id: placement.id, kind: assetFromId(placement.assetId)?.pickupKind ?? 'health', x: placement.x, y: placement.y })),
    mapInteractables: normalized.placements.filter((placement) => placement.category === 'interactable').map((placement) => ({ id: placement.id, kind: assetFromId(placement.assetId)?.interactableKind ?? 'cache', x: placement.x, y: placement.y, w: placement.w, h: placement.h })),
    sky: normalized.ambiance === 'street-rain' || normalized.ambiance === 'breach' ? 'rain' : normalized.ambiance === 'null-spores' ? 'roofed' : normalized.sky,
    mapFeature: normalized.mapFeature,
    authoredGroundTiles,
    landmark: landmarkSource ? { ...landmarkSource, position: normalized.landmarkPosition } : undefined,
    durationSec: normalized.durationSec,
    waves: waves.length > 0 ? waves : [{
      fromSec: 0,
      toSec: normalized.durationSec,
      enemyId: ENEMIES[0]!.id,
      ratePerSec: 0.6,
      burst: 1,
    }],
    unlock: { kind: 'default' },
    threat: normalized.threat,
  };
}

/** Convert a shipped arena to the same editable format used by saves and playtest. */
export function areaToCustomMapTemplate(area: AreaDef, id: string): CustomMap {
  const ground = GROUND_ASSETS.find((asset) => asset.areaId === area.id) ?? GROUND_ASSETS[0]!;
  const placements: CustomMapPlacement[] = [];
  const add = (assetId: string, x: number, y: number, w?: number, h?: number, extra: Partial<CustomMapPlacement> = {}) => {
    const asset = assetFromId(assetId);
    if (!asset || placements.length >= MAX_CUSTOM_MAP_PLACEMENTS) return;
    placements.push({ id: `template-${placements.length}`, assetId, category: asset.category as CustomMapPlacement['category'], x, y, w: w ?? asset.w ?? 60, h: h ?? asset.h ?? 60, ...extra });
  };
  for (const tile of area.authoredGroundTiles ?? []) {
    const match = TILE_ASSETS.find((asset) => asset.groundStyle?.base === tile.base && asset.groundStyle?.tile === tile.tile);
    if (match) add(match.id, tile.x, tile.y, tile.w, tile.h);
  }
  for (const obstacle of area.obstacles) {
    const assetId = obstacle.artAssetId ? `map-prop:${obstacle.artAssetId}` : `structure:${obstacle.kind}`;
    if (assetFromId(assetId)) add(assetId, obstacle.x, obstacle.y, obstacle.w, obstacle.h, { mode: obstacle.hp ? 'breakable' : 'permanent' });
  }
  for (const obstacle of area.decorations ?? []) if (obstacle.artAssetId) add(`map-prop:${obstacle.artAssetId}`, obstacle.x, obstacle.y, obstacle.w, obstacle.h, { mode: 'cosmetic' });
  if (area.playerStart) add('spawn-point:player', area.playerStart.x, area.playerStart.y);
  for (const entry of area.hostileEntries ?? []) add('spawn-point:hostile', entry.x, entry.y);
  for (const item of area.mapPickups ?? []) add(`pickup:${item.kind}`, item.x, item.y);
  for (const item of area.mapInteractables ?? []) add(`interactable:${item.kind}`, item.x, item.y, item.w, item.h);
  for (const wave of area.waves) {
    const assetId = `encounter:${wave.enemyId}`;
    const point = wave.spawnAt ?? area.hostileEntries?.[0] ?? { x: 0, y: 0 };
    add(assetId, point.x, point.y, undefined, undefined, { fromSec: wave.fromSec, toSec: wave.toSec, ratePerSec: wave.ratePerSec, burst: wave.burst });
  }
  return normalizeCustomMap({ version: 2, id, name: area.name, bounds: area.bounds, groundAssetId: ground.id, landmarkAssetId: null, placements, durationSec: area.durationSec, threat: area.threat, backdrop: area.backdrop, sky: area.sky, ambiance: area.id === 'floodline-breach' ? 'breach' : area.id === 'glassroot-annex' ? 'null-spores' : 'clear', mapFeature: area.mapFeature, updatedAt: Date.now() }, id)!;
}

/** A stable remix yields an ordinary editable map; no random state is retained at runtime. */
export function generateCustomMap(seed: string, theme: 'street' | 'null' | 'breach', id: string): CustomMap {
  let state = 2166136261;
  for (const character of `${theme}:${seed}`) state = Math.imul(state ^ character.charCodeAt(0), 16777619);
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
  const base = AREAS.find((area) => area.id === (theme === 'street' ? 'monroe-strip' : theme === 'null' ? 'glassroot-annex' : 'floodline-breach'))!;
  const map = areaToCustomMapTemplate(base, id);
  map.name = `${theme === 'breach' ? 'Breach' : theme === 'null' ? 'Null' : 'Street'} remix ${seed.slice(0, 12)}`;
  map.placements = map.placements.filter((placement) => !placement.id.startsWith('template-') || placement.category === 'spawn-point' || placement.category === 'interactable' || placement.category === 'pickup' || placement.category === 'tile');
  const prefabs = MAP_PREFABS.filter((prefab) => theme === 'breach' || prefab.theme === theme);
  for (let index = 0; index < 7; index += 1) {
    const prefab = prefabs[Math.floor(random() * prefabs.length)]!;
    const x = Math.round(((random() - 0.5) * (map.bounds.w - 500)) / CUSTOM_MAP_GRID) * CUSTOM_MAP_GRID;
    const y = Math.round(((random() - 0.5) * (map.bounds.h - 400)) / CUSTOM_MAP_GRID) * CUSTOM_MAP_GRID;
    const additions = expandMapPrefab(prefab, { x, y }, `remix-${index}`, Math.floor(random() * 4));
    map.placements.push(...additions.filter((piece) => Math.abs(piece.x) < map.bounds.w / 2 - piece.w / 2 && Math.abs(piece.y) < map.bounds.h / 2 - piece.h / 2));
  }
  const enemies = ENEMY_ASSETS.filter((asset) => theme === 'street' ? !asset.enemyId?.includes('root') : true);
  for (let index = 0; index < 5; index += 1) {
    const asset = enemies[Math.floor(random() * enemies.length)]!;
    const side = index % 2 ? -1 : 1;
    const fromSec = index * Math.floor(map.durationSec / 7);
    map.placements.push({ id: `remix-wave-${index}`, assetId: asset.id, category: 'enemy', x: side * (map.bounds.w / 2 - 100), y: Math.round((random() - 0.5) * (map.bounds.h - 200)), w: asset.w ?? 40, h: asset.h ?? 40, fromSec, toSec: map.durationSec, ratePerSec: 0.4 + random() * 0.5, burst: 1 + Math.floor(random() * 2) });
  }
  return normalizeCustomMap(map, id)!;
}

export function normalizePersonalPrefabs(value: unknown): MapPrefab[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 32).flatMap((candidate): MapPrefab[] => {
    if (!candidate || typeof candidate !== 'object') return [];
    const prefab = candidate as Partial<MapPrefab>;
    if (typeof prefab.id !== 'string' || !/^personal-[a-z0-9-]+$/i.test(prefab.id) || typeof prefab.name !== 'string' || !Array.isArray(prefab.pieces)) return [];
    const pieces = prefab.pieces.slice(0, 20).filter((piece) => piece && assetFromId(piece.assetId)).map((piece) => ({ ...piece, x: clampInt(piece.x, -1000, 1000, 0), y: clampInt(piece.y, -1000, 1000, 0) }));
    return pieces.length ? [{ id: prefab.id, name: prefab.name.slice(0, 40), theme: prefab.theme === 'null' ? 'null' : 'street', pieces }] : [];
  });
}
