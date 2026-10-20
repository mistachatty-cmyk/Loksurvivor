import type { AreaDef, ObstacleDef } from '@/game/types';
import { expandMapPrefab, MAP_PREFABS, MAP_PROP_ART_BY_ID } from './mapPack';

function prop(id: string, x: number, y: number, mode: 'permanent' | 'breakable' | 'cosmetic' = 'breakable', scale = 1): ObstacleDef {
  const art = MAP_PROP_ART_BY_ID[id]!;
  return {
    x, y, w: Math.round(art.w * scale), h: Math.round(art.h * scale),
    kind: 'map-prop', artAssetId: id,
    ...(mode === 'breakable' ? { hp: id === 'root-arch' ? 220 : 120, propVariant: 'fixed-breakable' as const } : { propVariant: 'fixed-bench' as const }),
  };
}

function group(id: string, x: number, y: number, turns = 0): Array<{ obstacle: ObstacleDef; cosmetic: boolean }> {
  const prefab = MAP_PREFABS.find((candidate) => candidate.id === id)!;
  return expandMapPrefab(prefab, { x, y }, `area-${id}-${x}-${y}`, turns).map((placement) => ({
    obstacle: prop(placement.assetId.slice('map-prop:'.length), placement.x, placement.y, placement.mode),
    cosmetic: placement.mode === 'cosmetic',
  }));
}

const floodGroups = [
  group('platform-corner', -810, 210), group('platform-corner', -350, -280, 1),
  group('flooded-checkpoint', -680, -530), group('relay-worksite', 500, -610),
  group('street-cache', -870, 670), group('root-gate', 480, 180),
  group('spore-garden', 790, 420), group('resin-nest', 865, -180),
  group('null-shrine', 710, -515),
].flat();

const annexGroups = [
  group('root-gate', -460, -380), group('root-gate', 480, 420, 1),
  group('spore-garden', -490, 350), group('spore-garden', 430, -370),
  group('resin-nest', -80, -475), group('resin-nest', 100, 485, 2),
  group('null-shrine', 0, 0),
].flat();

const floodObstacles = [
  ...floodGroups.filter((entry) => !entry.cosmetic).map((entry) => entry.obstacle),
  prop('transit-shelter', -980, -245, 'permanent'), prop('bus-wreck', -1020, 380),
  prop('ticket-kiosk', -355, 435), prop('barricade', 0, -490, 'permanent'),
  prop('power-cabinet', -510, -655), prop('power-cabinet', 505, -715),
  prop('node-pylon', 575, 370), prop('node-pylon', 825, 30), prop('node-pylon', 650, -290),
  prop('resin-pod', 1010, 565), prop('bus-wreck', -170, 620),
  { x: -930, y: -630, w: 130, h: 42, kind: 'cover' as const },
  { x: -105, y: -720, w: 105, h: 35, kind: 'cover' as const },
  { x: 280, y: 680, w: 100, h: 34, kind: 'reflective-surface' as const },
];

const annexObstacles = [
  ...annexGroups.filter((entry) => !entry.cosmetic).map((entry) => entry.obstacle),
  prop('root-arch', -580, 70, 'permanent'), prop('root-arch', 570, -50, 'permanent'),
  prop('node-pylon', -600, -540), prop('node-pylon', 595, 515),
  prop('resin-pod', -270, -210), prop('resin-pod', 280, 240),
  { x: -320, y: 85, w: 68, h: 54, kind: 'reflective-surface' as const },
  { x: 330, y: -85, w: 68, h: 54, kind: 'reflective-surface' as const },
];

export const AREAS_BREACH: AreaDef[] = [
  {
    id: 'floodline-breach', name: 'Floodline Breach', district: '616 / Null transit fracture',
    description: 'A rain-slick exchange where city rail lines meet living roots. Restore the relays, break the anchors, and survive the night at the fractured 616 station.',
    backdrop: 'art/street.jpeg', bounds: { w: 2400, h: 1800 },
    ground: { base: '#101c25', tile: '#182b37', seam: '#0c141c', glow: '#fbbf24' },
    authoredGroundTiles: [
      { x: -790, y: 0, w: 760, h: 1560, base: '#172331', tile: '#263544', seam: '#0c141c', glow: '#fbbf24' },
      { x: -150, y: 30, w: 380, h: 1490, base: '#132e3b', tile: '#1b4651', seam: '#0a1c24', glow: '#60a5fa' },
      { x: 650, y: 70, w: 950, h: 1570, base: '#04251e', tile: '#0a3d30', seam: '#021813', glow: '#34d399' },
    ],
    sky: 'rain',
    mapFeature: 'fractured-616',
    landmark: { name: 'Fractured 616 Exchange', description: 'The city number split open by a luminous root network.', kind: 'plaza', accent: '#fbbf24', position: { x: -70, y: -80 } },
    playerStart: { x: -975, y: 680 },
    hostileEntries: [{ x: -1080, y: -550 }, { x: 1070, y: 480 }, { x: 680, y: -760 }],
    obstacles: floodObstacles,
    decorations: [
      ...floodGroups.filter((entry) => entry.cosmetic).map((entry) => entry.obstacle),
      prop('rail-sign', -590, 420, 'cosmetic'), prop('living-cable', 230, -80, 'cosmetic'),
      prop('holographic-tree', 960, -590, 'cosmetic'), prop('lamp-cluster', -1000, -730, 'cosmetic'),
    ],
    mapInteractables: [
      { id: 'flood-relay-west', kind: 'relay', x: -510, y: -655, w: 68, h: 64 },
      { id: 'flood-relay-north', kind: 'relay', x: 505, y: -715, w: 68, h: 64 },
      { id: 'flood-anchor-east', kind: 'root-anchor', x: 575, y: 370, w: 62, h: 82 },
      { id: 'flood-anchor-mid', kind: 'root-anchor', x: 825, y: 30, w: 62, h: 82 },
      { id: 'flood-anchor-north', kind: 'root-anchor', x: 650, y: -290, w: 62, h: 82 },
      { id: 'flood-cache', kind: 'cache', x: -870, y: 670, w: 72, h: 52 },
      { id: 'flood-plate', kind: 'plate', x: -125, y: -120, w: 48, h: 48 },
      { id: 'flood-coil', kind: 'coil', x: 820, y: -520, w: 48, h: 48 },
    ],
    mapPickups: [
      { id: 'flood-health', kind: 'health', x: -410, y: 535, value: 25 },
      { id: 'flood-cred', kind: 'cred', x: -890, y: -690, value: 30 },
      { id: 'flood-resin', kind: 'cyber-resin', x: 970, y: 540, value: 2 },
      { id: 'flood-rootglass', kind: 'rootglass-cell', x: 300, y: 510 },
    ],
    durationSec: 480, threat: 'high', unlock: { kind: 'default' }, discoveryId: 'floodline-breach-log',
    waves: [
      { fromSec: 0, toSec: 110, enemyId: 'nightcrawler', ratePerSec: 0.85, burst: 1, spawnAt: { x: -1080, y: -550 } },
      { fromSec: 55, toSec: 170, enemyId: 'neon-leech', ratePerSec: 0.6, burst: 2, spawnAt: { x: -1080, y: -550 } },
      { fromSec: 120, toSec: 350, enemyId: 'cyber-root-trapper', ratePerSec: 0.36, burst: 1, spawnAt: { x: 1070, y: 480 } },
      { fromSec: 165, toSec: 410, enemyId: 'digital-mimic-tree', ratePerSec: 0.52, burst: 2, spawnAt: { x: 680, y: -760 } },
      { fromSec: 220, toSec: 480, enemyId: 'spore-arbor-mortar', ratePerSec: 0.32, burst: 1, spawnAt: { x: 1070, y: 480 } },
      { fromSec: 320, toSec: 480, enemyId: 'bloodhound', ratePerSec: 0.75, burst: 2, spawnAt: { x: -1080, y: -550 } },
      { fromSec: 420, toSec: 480, enemyId: 'cyber-root-trapper', ratePerSec: 0.75, burst: 2, spawnAt: { x: 680, y: -760 } },
    ],
  },
  {
    id: 'glassroot-annex', name: 'Glassroot Annex', district: 'Silicon Arboretum annex',
    description: 'A small chamber of glassy roots, false trees and a quiet central shrine. The decoys hide three hostile approaches.',
    backdrop: 'art/cellar.jpeg', bounds: { w: 1600, h: 1400 },
    ground: { base: '#031a17', tile: '#0b302a', seam: '#02110f', glow: '#5eead4' }, sky: 'roofed',
    mapFeature: 'glassroot-shrine',
    authoredGroundTiles: [
      { x: 0, y: 0, w: 500, h: 450, base: '#153b39', tile: '#22514a', seam: '#05211e', glow: '#a78bfa' },
    ],
    landmark: { name: 'Glassroot Shrine', description: 'A crystalline stump ringed by false trees.', kind: 'plaza', accent: '#a78bfa', position: { x: 0, y: 0 } },
    playerStart: { x: -655, y: 540 },
    hostileEntries: [{ x: -690, y: -560 }, { x: 690, y: -550 }, { x: 690, y: 550 }],
    obstacles: annexObstacles,
    decorations: [
      ...annexGroups.filter((entry) => entry.cosmetic).map((entry) => entry.obstacle),
      prop('holographic-tree', -370, 520, 'cosmetic'), prop('living-cable', 30, 310, 'cosmetic'),
      prop('pulse-sapling', 520, 120, 'cosmetic'),
    ],
    mapInteractables: [
      { id: 'annex-cache', kind: 'cache', x: 490, y: -380, w: 72, h: 52 },
      { id: 'annex-anchor', kind: 'root-anchor', x: -600, y: -540, w: 62, h: 82 },
    ],
    mapPickups: [
      { id: 'annex-health', kind: 'health', x: -370, y: 220, value: 25 },
      { id: 'annex-resin', kind: 'cyber-resin', x: 530, y: 330, value: 2 },
      { id: 'annex-rootglass', kind: 'rootglass-cell', x: 0, y: -420 },
    ],
    durationSec: 360, threat: 'rising', unlock: { kind: 'clearArea', areaId: 'floodline-breach' }, discoveryId: 'glassroot-annex-log',
    waves: [
      { fromSec: 0, toSec: 180, enemyId: 'digital-mimic-tree', ratePerSec: 0.42, burst: 1, spawnAt: { x: -690, y: -560 } },
      { fromSec: 80, toSec: 280, enemyId: 'cyber-root-trapper', ratePerSec: 0.34, burst: 1, spawnAt: { x: 690, y: -550 } },
      { fromSec: 160, toSec: 360, enemyId: 'spore-arbor-mortar', ratePerSec: 0.4, burst: 1, spawnAt: { x: 690, y: 550 } },
      { fromSec: 270, toSec: 360, enemyId: 'digital-mimic-tree', ratePerSec: 0.85, burst: 2, spawnAt: { x: -690, y: -560 } },
    ],
  },
];
