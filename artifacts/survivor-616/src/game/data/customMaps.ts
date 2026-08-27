import { AREAS } from '@/game/data/areas';
import { ENEMIES } from '@/game/data/enemies';
import type {
  AreaDef,
  CustomMap,
  CustomMapAsset,
  CustomMapPlacement,
  ObstacleDef,
  WaveDef,
} from '@/game/types';

export const MAX_CUSTOM_MAPS = 12;
export const MAX_CUSTOM_MAP_PLACEMENTS = 120;
export const CUSTOM_MAP_GRID = 20;
export const CUSTOM_MAP_MIN_BOUNDS = { w: 480, h: 360 };
export const CUSTOM_MAP_MAX_BOUNDS = { w: 1400, h: 1000 };

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

const STRUCTURE_KINDS: Array<ObstacleDef['kind']> = [
  'car', 'dumpster', 'crate', 'planter', 'barrier', 'ac-unit', 'neon-sign',
  'barrel', 'fuse-box', 'street-lamp', 'car-wreck', 'crate-breakable',
  'security-camera', 'cover', 'reflective-surface', 'flora', 'building',
  'metal-box', 'bench',
];

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

export const CUSTOM_MAP_ASSETS: CustomMapAsset[] = [
  ...GROUND_ASSETS,
  ...STRUCTURE_ASSETS,
  ...HAZARD_ASSETS,
  ...LANDMARK_ASSETS,
  ...ENEMY_ASSETS,
  ...ENCOUNTER_ASSETS,
];

export const CUSTOM_MAP_ASSETS_BY_ID: Record<string, CustomMapAsset> = Object.fromEntries(
  CUSTOM_MAP_ASSETS.map((asset) => [asset.id, asset]),
);

export const CUSTOM_MAP_ASSET_CATEGORIES = [
  { id: 'ground', label: 'Ground styles' },
  { id: 'structure', label: 'Structures & props' },
  { id: 'hazard', label: 'Hazards' },
  { id: 'landmark', label: 'Landmarks' },
  { id: 'enemy', label: 'Enemies' },
  { id: 'encounter', label: 'Encounters & waves' },
] as const;

export function assetFromId(assetId: string): CustomMapAsset | undefined {
  return CUSTOM_MAP_ASSETS_BY_ID[assetId];
}

export function createCustomMap(id = `custom-${Date.now().toString(36)}`): CustomMap {
  const ground = GROUND_ASSETS[0]!;
  return {
    id,
    name: 'New night route',
    bounds: { ...CUSTOM_MAP_MIN_BOUNDS },
    groundAssetId: ground.id,
    landmarkAssetId: null,
    placements: [],
    durationSec: 120,
    threat: 'rising',
    backdrop: AREAS.find((area) => area.id === ground.areaId)?.backdrop ?? 'art/street.jpeg',
    updatedAt: Date.now(),
  };
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  return Math.round(Math.min(max, Math.max(min, finite(value, fallback))));
}

function validCategory(value: unknown): CustomMapPlacement['category'] | null {
  return value === 'structure' || value === 'hazard' || value === 'landmark' ||
    value === 'enemy' || value === 'encounter'
    ? value
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
      const w = clampInt(item.w, 12, 260, asset.w ?? 60);
      const h = clampInt(item.h, 12, 260, asset.h ?? 60);
      placements.push({
        id: typeof item.id === 'string' ? item.id.slice(0, 64) : `placement-${placements.length + 1}`,
        assetId: asset.id,
        category,
        x: clampInt(item.x, -bounds.w / 2 + w / 2, bounds.w / 2 - w / 2, 0),
        y: clampInt(item.y, -bounds.h / 2 + h / 2, bounds.h / 2 - h / 2, 0),
        w,
        h,
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
    id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 48) : fallback.name,
    bounds,
    groundAssetId: ground?.category === 'ground' ? ground.id : fallback.groundAssetId,
    landmarkAssetId,
    placements,
    durationSec: clampInt(raw.durationSec, 60, 600, fallback.durationSec),
    threat,
    backdrop: ground?.areaId ? (AREAS.find((area) => area.id === ground.areaId)?.backdrop ?? fallback.backdrop) : fallback.backdrop,
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
  const waves: WaveDef[] = normalized.placements
    .filter((placement) => placement.category === 'enemy' || placement.category === 'encounter')
    .map((placement, index) => {
      const asset = assetFromId(placement.assetId);
      const enemyId = asset?.enemyId ?? ENEMIES[0]!.id;
      return {
        ...(asset?.wave ?? {}),
        fromSec: Math.min(normalized.durationSec - 1, index * 8),
        toSec: normalized.durationSec,
        enemyId,
        ratePerSec: asset?.wave?.ratePerSec ?? 0.65,
        burst: asset?.wave?.burst ?? 1,
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
    landmark: landmarkSource ? { ...landmarkSource } : undefined,
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