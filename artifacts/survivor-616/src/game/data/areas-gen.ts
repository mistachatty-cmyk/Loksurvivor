import type { AreaDef, ObstacleDef } from '@/game/types';
import { expandMapPrefab, MAP_PREFABS, MAP_PROP_ART_BY_ID } from './mapPack';

function prop(id: string, x: number, y: number, mode: 'permanent' | 'breakable' | 'cosmetic' = 'breakable'): ObstacleDef {
  const art = MAP_PROP_ART_BY_ID[id]!;
  return {
    x, y, w: art.w, h: art.h,
    kind: 'map-prop', artAssetId: id,
    ...(mode === 'breakable' ? { hp: 120, propVariant: 'fixed-breakable' as const } : { propVariant: 'fixed-bench' as const }),
  };
}

function group(id: string, x: number, y: number, turns = 0): Array<{ obstacle: ObstacleDef; cosmetic: boolean }> {
  const prefab = MAP_PREFABS.find((candidate) => candidate.id === id)!;
  return expandMapPrefab(prefab, { x, y }, `area-${id}-${x}-${y}`, turns).map((placement) => ({
    obstacle: prop(placement.assetId.slice('map-prop:'.length), placement.x, placement.y, placement.mode),
    cosmetic: placement.mode === 'cosmetic',
  }));
}

/** Prefab clusters stamped, turned and remixed the way the map builder does. */
const fittingGroups = [
  group('platform-corner', -700, -420), group('platform-corner', 690, 430, 2),
  group('root-gate', -620, 380, 1), group('root-gate', 640, -400, 3),
  group('relay-worksite', 0, -470), group('street-cache', 20, 480, 2),
  group('spore-garden', -240, 40), group('resin-nest', 260, -30, 1),
  group('null-shrine', 0, 0),
].flat();

/**
 * Gen Fitting Floor: a finite arena built to look like the customization
 * screens. Each ground zone is a different painted tile treatment (the
 * palettes), the stamped prefab clusters are the map builder's groups, and
 * the Gen Fitters that spawn here are aura, skin, hat, prefab and undo
 * gags made hostile. All scenery is existing props -- no new texture work.
 */
export const AREAS_GEN: AreaDef[] = [
  {
    id: 'gen-fitting-floor', name: 'Gen Fitting Floor', district: 'The 616 customization hall',
    description: 'A showroom floor repainted in a different palette every few steps. Paint chips, loose auras, shed skins and ungrouped prefabs stalk the zones; the Tile Warden holds the seams together.',
    backdrop: 'art/cellar.jpeg', bounds: { w: 2200, h: 1600 },
    ground: { base: '#120a1f', tile: '#1d1230', seam: '#08040f', glow: '#e879f9' },
    authoredGroundTiles: [
      { x: -600, y: -340, w: 720, h: 640, base: '#2a1109', tile: '#431a0d', seam: '#150804', glow: '#fb923c' },
      { x: 600, y: -340, w: 720, h: 640, base: '#06202b', tile: '#0b3a4d', seam: '#031219', glow: '#22d3ee' },
      { x: -600, y: 440, w: 720, h: 540, base: '#06241a', tile: '#0b3d2c', seam: '#03140e', glow: '#a3e635' },
      { x: 600, y: 440, w: 720, h: 540, base: '#26072c', tile: '#3f0f47', seam: '#13031a', glow: '#f472b6' },
    ],
    sky: 'roofed',
    landmark: { name: 'The Swatch Plaza', description: 'A plaza where every tile is a different saved palette.', kind: 'plaza', accent: '#e879f9', position: { x: 0, y: 0 } },
    playerStart: { x: 0, y: 40 },
    hostileEntries: [{ x: -1000, y: -700 }, { x: 1000, y: -700 }, { x: -1000, y: 700 }, { x: 1000, y: 700 }],
    obstacles: [
      ...fittingGroups.filter((entry) => !entry.cosmetic).map((entry) => entry.obstacle),
      prop('barricade', -330, -640, 'permanent'), prop('barricade', 330, 640, 'permanent'),
      prop('power-cabinet', -880, 40), prop('power-cabinet', 880, -30),
      prop('node-pylon', -470, 250), prop('node-pylon', 480, -250),
      { x: -960, y: 600, w: 120, h: 38, kind: 'cover' as const },
      { x: 960, y: -600, w: 120, h: 38, kind: 'cover' as const },
      { x: 300, y: 330, w: 90, h: 34, kind: 'reflective-surface' as const },
      { x: -300, y: -320, w: 90, h: 34, kind: 'reflective-surface' as const },
    ],
    decorations: [
      ...fittingGroups.filter((entry) => entry.cosmetic).map((entry) => entry.obstacle),
      prop('lamp-cluster', -1000, 0, 'cosmetic'), prop('lamp-cluster', 1000, 0, 'cosmetic'),
      prop('holographic-tree', 0, -700, 'cosmetic'), prop('living-cable', 0, 690, 'cosmetic'),
    ],
    mapPickups: [
      { id: 'gen-health-west', kind: 'health', x: -820, y: -80, value: 25 },
      { id: 'gen-health-east', kind: 'health', x: 820, y: 80, value: 25 },
      { id: 'gen-cred', kind: 'cred', x: 0, y: -600, value: 40 },
    ],
    durationSec: 420, threat: 'high', unlock: { kind: 'clearArea', areaId: 'glassroot-annex' }, discoveryId: 'gen-fitting-floor-log',
    waves: [
      { fromSec: 0, toSec: 90, enemyId: 'gen-swatch-mite', ratePerSec: 1.6, burst: 3, formation: 'ring', faction: 'Gen Fitters' },
      { fromSec: 35, toSec: 170, enemyId: 'gen-aura-ringer', ratePerSec: 0.7, burst: 2, faction: 'Gen Fitters' },
      { fromSec: 70, toSec: 230, enemyId: 'gen-skin-shedder', ratePerSec: 0.55, burst: 2, formation: 'pincer', faction: 'Gen Fitters' },
      { fromSec: 110, toSec: 300, enemyId: 'gen-hat-hurler', ratePerSec: 0.4, burst: 2, formation: 'wall', faction: 'Gen Fitters' },
      { fromSec: 150, toSec: 360, enemyId: 'gen-remix-seed', ratePerSec: 0.34, burst: 1, faction: 'Gen Fitters' },
      { fromSec: 190, toSec: 420, enemyId: 'gen-prefab-brute', ratePerSec: 0.22, burst: 1, hpMult: 1.1, faction: 'Gen Fitters' },
      { fromSec: 240, toSec: 420, enemyId: 'gen-undo-echo', ratePerSec: 0.42, burst: 2, formation: 'file', faction: 'Gen Fitters' },
      { fromSec: 300, toSec: 420, enemyId: 'gen-swatch-mite', ratePerSec: 2, burst: 4, group: ['gen-aura-ringer'], formation: 'ring', faction: 'Gen Fitters' },
      { fromSec: 380, toSec: 390, enemyId: 'gen-tile-warden', ratePerSec: 0.1, burst: 1, hpMult: 1.2, faction: 'Gen Fitters' },
    ],
  },
];
