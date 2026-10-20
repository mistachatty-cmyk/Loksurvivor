import type { CustomMapAsset, CustomMapPlacement } from '@/game/types';

export interface MapPropArt {
  id: string;
  name: string;
  theme: 'street' | 'null';
  color: string;
  w: number;
  h: number;
  modes: Array<NonNullable<CustomMapPlacement['mode']>>;
}

/** Each record has a distinct silhouette in drawMapPackProp. */
export const MAP_PROP_ART: MapPropArt[] = [
  { id: 'transit-shelter', name: 'Transit shelter', theme: 'street', color: '#fbbf24', w: 156, h: 78, modes: ['permanent', 'breakable'] },
  { id: 'bus-wreck', name: 'Bus wreck', theme: 'street', color: '#fb923c', w: 168, h: 76, modes: ['permanent', 'breakable'] },
  { id: 'ticket-kiosk', name: 'Ticket kiosk', theme: 'street', color: '#38bdf8', w: 80, h: 76, modes: ['permanent', 'breakable'] },
  { id: 'rail-sign', name: 'Rail sign', theme: 'street', color: '#facc15', w: 88, h: 34, modes: ['permanent', 'breakable', 'cosmetic'] },
  { id: 'lamp-cluster', name: 'Lamp cluster', theme: 'street', color: '#fde68a', w: 64, h: 56, modes: ['permanent', 'breakable', 'cosmetic'] },
  { id: 'power-cabinet', name: 'Power cabinet', theme: 'street', color: '#60a5fa', w: 68, h: 64, modes: ['permanent', 'breakable'] },
  { id: 'barricade', name: 'Flood barricade', theme: 'street', color: '#fb923c', w: 122, h: 38, modes: ['permanent', 'breakable'] },
  { id: 'cache-cart', name: 'Cache cart', theme: 'street', color: '#f59e0b', w: 72, h: 52, modes: ['permanent', 'breakable', 'cosmetic'] },
  { id: 'root-arch', name: 'Root arch', theme: 'null', color: '#34d399', w: 140, h: 54, modes: ['permanent', 'breakable', 'cosmetic'] },
  { id: 'pulse-sapling', name: 'Pulse sapling', theme: 'null', color: '#6ee7b7', w: 62, h: 72, modes: ['permanent', 'breakable', 'cosmetic'] },
  { id: 'holographic-tree', name: 'Holographic tree', theme: 'null', color: '#67e8f9', w: 72, h: 72, modes: ['cosmetic'] },
  { id: 'spore-vent', name: 'Spore vent', theme: 'null', color: '#a7f3d0', w: 66, h: 52, modes: ['permanent', 'breakable', 'cosmetic'] },
  { id: 'resin-pod', name: 'Resin pod', theme: 'null', color: '#2dd4bf', w: 68, h: 66, modes: ['permanent', 'breakable', 'cosmetic'] },
  { id: 'living-cable', name: 'Living cable', theme: 'null', color: '#5eead4', w: 126, h: 26, modes: ['cosmetic'] },
  { id: 'crystal-stump', name: 'Crystal stump', theme: 'null', color: '#a78bfa', w: 72, h: 70, modes: ['permanent', 'breakable', 'cosmetic'] },
  { id: 'node-pylon', name: 'Node pylon', theme: 'null', color: '#34d399', w: 62, h: 82, modes: ['permanent', 'breakable'] },
];

export const MAP_PROP_ART_BY_ID: Record<string, MapPropArt> = Object.fromEntries(MAP_PROP_ART.map((art) => [art.id, art]));

export const MAP_PACK_ASSETS: CustomMapAsset[] = MAP_PROP_ART.map((art) => ({
  id: `map-prop:${art.id}`,
  category: 'structure',
  name: art.name,
  description: `${art.theme === 'null' ? 'Null grove' : '616 street'} scenery · ${art.modes.join(', ')}`,
  color: art.color,
  w: art.w,
  h: art.h,
  artAssetId: art.id,
  defaultMode: art.modes.includes('breakable') ? 'breakable' : art.modes[0],
}));

export interface MapPrefab {
  id: string;
  name: string;
  theme: 'street' | 'null';
  pieces: Array<{ assetId: string; x: number; y: number; w?: number; h?: number; category?: CustomMapPlacement['category']; mode?: CustomMapPlacement['mode']; fromSec?: number; toSec?: number; ratePerSec?: number; burst?: number }>;
}

const piece = (id: string, x: number, y: number, mode?: CustomMapPlacement['mode']) => ({ assetId: `map-prop:${id}`, x, y, mode });

export const MAP_PREFABS: MapPrefab[] = [
  { id: 'platform-corner', name: 'Platform corner', theme: 'street', pieces: [piece('transit-shelter', -62, 0), piece('rail-sign', 84, -68, 'cosmetic'), piece('lamp-cluster', 86, 34, 'cosmetic')] },
  { id: 'flooded-checkpoint', name: 'Flooded checkpoint', theme: 'street', pieces: [piece('barricade', -78, 0), piece('barricade', 78, 0), piece('power-cabinet', 0, -82)] },
  { id: 'relay-worksite', name: 'Relay worksite', theme: 'street', pieces: [piece('power-cabinet', 0, 0), piece('lamp-cluster', -88, 18, 'cosmetic'), piece('cache-cart', 84, 25)] },
  { id: 'street-cache', name: 'Street cache', theme: 'street', pieces: [piece('cache-cart', 0, 0), piece('bus-wreck', -112, -70), piece('rail-sign', 102, -62, 'cosmetic')] },
  { id: 'root-gate', name: 'Root gate', theme: 'null', pieces: [piece('root-arch', 0, 0), piece('node-pylon', -105, 18), piece('node-pylon', 105, 18)] },
  { id: 'spore-garden', name: 'Spore garden', theme: 'null', pieces: [piece('spore-vent', -65, 10), piece('spore-vent', 68, -8), piece('pulse-sapling', 0, -85, 'cosmetic')] },
  { id: 'resin-nest', name: 'Resin nest', theme: 'null', pieces: [piece('resin-pod', -65, 0), piece('resin-pod', 58, 18), piece('living-cable', 0, -68, 'cosmetic')] },
  { id: 'null-shrine', name: 'Null shrine', theme: 'null', pieces: [piece('crystal-stump', 0, 0), piece('holographic-tree', -102, -62, 'cosmetic'), piece('holographic-tree', 102, -62, 'cosmetic'), piece('node-pylon', 0, 100)] },
];

export function expandMapPrefab(prefab: MapPrefab, origin: { x: number; y: number }, groupId: string, turns = 0): CustomMapPlacement[] {
  const rotation = ((turns % 4) + 4) % 4;
  return prefab.pieces.map((member, index) => {
    const asset = MAP_PACK_ASSETS.find((item) => item.id === member.assetId);
    let x = member.x;
    let y = member.y;
    for (let turn = 0; turn < rotation; turn += 1) [x, y] = [-y, x];
    return {
      id: `${groupId}-${index}`,
      groupId,
      category: member.category ?? 'structure',
      assetId: member.assetId,
      x: origin.x + x,
      y: origin.y + y,
      w: rotation % 2 === 1 ? member.h ?? asset?.h ?? 60 : member.w ?? asset?.w ?? 60,
      h: rotation % 2 === 1 ? member.w ?? asset?.w ?? 60 : member.h ?? asset?.h ?? 60,
      mode: member.mode ?? asset?.defaultMode,
      ...(member.fromSec !== undefined ? { fromSec: member.fromSec } : {}),
      ...(member.toSec !== undefined ? { toSec: member.toSec } : {}),
      ...(member.ratePerSec !== undefined ? { ratePerSec: member.ratePerSec } : {}),
      ...(member.burst !== undefined ? { burst: member.burst } : {}),
    };
  });
}
