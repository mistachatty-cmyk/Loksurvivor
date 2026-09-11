import type { AreaDef, ObstacleDef } from '@/game/types';

function ring(kind: ObstacleDef['kind'], radius: number, count: number, size = 54): ObstacleDef[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (Math.PI * 2 * index) / count;
    return {
      x: Math.round(Math.cos(angle) * radius),
      y: Math.round(Math.sin(angle) * radius),
      w: size,
      h: size,
      kind,
    };
  });
}

function orchardRows(): ObstacleDef[] {
  const rows: ObstacleDef[] = [];
  for (let y = -480; y <= 480; y += 240) {
    for (let x = -820; x <= 820; x += 205) {
      if (Math.abs(x) < 180 && Math.abs(y) < 180) continue;
      const fuseTree = (x / 205 + y / 240) % 3 === 0;
      rows.push({ x, y, w: fuseTree ? 48 : 42, h: fuseTree ? 48 : 44, kind: fuseTree ? 'fuse-box' : 'flora' });
    }
  }
  return rows;
}

/**
 * Odd Routes are large authored arenas built entirely from existing props.
 * Their strangeness comes from layout grammar and wave formations, not new
 * textures or a parallel map engine.
 */
export const WEIRD_AREAS: AreaDef[] = [
  {
    id: 'mirror-mile',
    name: 'Mirror Mile',
    district: 'A street reflected too many times',
    description: 'A long neon corridor where every shot returns from somewhere else. The center lane is safe until both sides notice you.',
    backdrop: 'art/street.jpeg',
    bounds: { w: 1900, h: 1000 },
    ground: { base: '#0b1020', tile: '#151c33', seam: '#070913', glow: '#72f5ff' },
    sky: 'fog',
    obstacles: [
      ...Array.from({ length: 7 }, (_, index): ObstacleDef => ({ x: -720 + index * 240, y: -330, w: 120, h: 28, kind: 'reflective-surface' })),
      ...Array.from({ length: 7 }, (_, index): ObstacleDef => ({ x: 720 - index * 240, y: 330, w: 120, h: 28, kind: 'reflective-surface' })),
      { x: -720, y: 0, w: 64, h: 64, kind: 'metal-box', propVariant: 'heavy-metal' },
      { x: 720, y: 0, w: 64, h: 64, kind: 'metal-box', propVariant: 'heavy-metal' },
      { x: 0, y: -210, w: 52, h: 52, kind: 'neon-sign' },
      { x: 0, y: 210, w: 52, h: 52, kind: 'neon-sign' },
    ],
    durationSec: 205,
    threat: 'high',
    landmark: { name: 'The Wrong Reflection', description: 'A plaza made from reflected streetlight and bad timing.', kind: 'plaza', accent: '#72f5ff' },
    unlock: { kind: 'default' },
    waves: [
      { fromSec: 0, toSec: 70, enemyId: 'corner-cutter', ratePerSec: 1.15, burst: 2, formation: 'pincer' },
      { fromSec: 28, toSec: 125, enemyId: 'bridge-lookout', ratePerSec: 0.55, burst: 2, formation: 'wall' },
      { fromSec: 62, toSec: 205, enemyId: 'river-wraith', ratePerSec: 0.72, burst: 2, formation: 'file' },
      { fromSec: 105, toSec: 205, enemyId: 'lightless-prowler', ratePerSec: 0.85, burst: 2, hpMult: 1.18 },
      { fromSec: 155, toSec: 205, enemyId: 'crypt-bouncer', ratePerSec: 0.3, burst: 1, hpMult: 1.3 },
    ],
  },
  {
    id: 'clockmouth-roundabout',
    name: 'Clockmouth Roundabout',
    district: 'The minute between 6:15 and never',
    description: 'Three circular streets turn around a pothole clock. Enemies arrive like hands sweeping a face, then reverse the formation.',
    backdrop: 'art/rooftops.jpeg',
    bounds: { w: 1800, h: 1800 },
    ground: { base: '#17100b', tile: '#271a13', seam: '#0b0806', glow: '#d8ff4f' },
    sky: 'overcast',
    obstacles: [
      ...ring('bench', 300, 8, 70).map((obstacle) => ({ ...obstacle, propVariant: 'fixed-bench' as const })),
      ...ring('reflective-surface', 610, 12, 58),
      { x: 0, y: 0, w: 118, h: 118, kind: 'pothole', pothole: { trigger: 'ground-shock', warningMs: 850, lethalRadius: 52 } },
      { x: 0, y: 440, w: 46, h: 58, kind: 'parking-meter' },
      { x: 440, y: 0, w: 46, h: 58, kind: 'parking-meter' },
      { x: 0, y: -440, w: 46, h: 58, kind: 'parking-meter' },
      { x: -440, y: 0, w: 46, h: 58, kind: 'parking-meter' },
    ],
    durationSec: 230,
    threat: 'severe',
    landmark: { name: 'The Twelve-Tooth Clock', description: 'A roundabout that measures crowds instead of hours.', kind: 'plaza', accent: '#d8ff4f' },
    unlock: { kind: 'default' },
    randomDrops: { intervalMs: 6800 },
    waves: [
      { fromSec: 0, toSec: 85, enemyId: 'ring-runner', ratePerSec: 1.25, burst: 4, formation: 'ring' },
      { fromSec: 35, toSec: 145, enemyId: 'neon-leech', ratePerSec: 1.1, burst: 3, formation: 'ring' },
      { fromSec: 78, toSec: 230, enemyId: 'corner-cutter', ratePerSec: 0.82, burst: 2, formation: 'pincer' },
      { fromSec: 122, toSec: 230, enemyId: 'choir-wraith', ratePerSec: 0.18, burst: 2, formation: 'ring' },
      { fromSec: 175, toSec: 230, enemyId: 'bass-bruiser', ratePerSec: 0.34, burst: 1, hpMult: 1.35 },
    ],
  },
  {
    id: 'null-orchard',
    name: 'Null Orchard',
    district: 'Municipal garden, signal not found',
    description: 'Rows of trees grow fuse boxes instead of fruit. Some hum, some spark, and the fog keeps moving even when the wind stops.',
    backdrop: 'art/cellar.jpeg',
    bounds: { w: 2200, h: 1400 },
    ground: { base: '#07150f', tile: '#0d251a', seam: '#040b08', glow: '#8cff66' },
    sky: 'fog',
    obstacles: [
      ...orchardRows(),
      { x: -930, y: 0, w: 130, h: 30, kind: 'barrier' },
      { x: 930, y: 0, w: 130, h: 30, kind: 'barrier' },
      { x: 0, y: -560, w: 58, h: 58, kind: 'crate-breakable' },
      { x: 0, y: 560, w: 58, h: 58, kind: 'crate-breakable' },
    ],
    durationSec: 240,
    threat: 'high',
    landmark: { name: 'Tree Zero', description: 'The first fuse box to flower. It is still connected to something.', kind: 'plaza', accent: '#8cff66' },
    unlock: { kind: 'clearArea', areaId: 'mirror-mile' },
    randomDrops: { intervalMs: 5200 },
    waves: [
      { fromSec: 0, toSec: 80, enemyId: 'ash-wisp', ratePerSec: 1.4, burst: 3, formation: 'file' },
      { fromSec: 30, toSec: 150, enemyId: 'spiral-moth', ratePerSec: 0.78, burst: 2, formation: 'wedge' },
      { fromSec: 72, toSec: 240, enemyId: 'smoke-horn', ratePerSec: 0.3, burst: 1, group: ['ember-hauler'] },
      { fromSec: 118, toSec: 240, enemyId: 'hollow-echo', ratePerSec: 0.72, burst: 2, formation: 'bait' },
      { fromSec: 188, toSec: 240, enemyId: 'crypt-bouncer', ratePerSec: 0.32, burst: 1, hpMult: 1.35 },
    ],
  },
  {
    id: 'sideways-forty',
    name: 'Forty Floors Sideways',
    district: 'Elevator Graveyard',
    description: 'Forty elevator doors laid end to end beneath the city. The call buttons shoot back, and every floor insists it is the lobby.',
    backdrop: 'art/alley.jpeg',
    bounds: { w: 1300, h: 2200 },
    ground: { base: '#151018', tile: '#211727', seam: '#0b080d', glow: '#ff70d2' },
    sky: 'roofed',
    obstacles: [
      ...Array.from({ length: 8 }, (_, index): ObstacleDef => ({ x: -430, y: -820 + index * 235, w: 74, h: 96, kind: index % 3 === 0 ? 'attack-block' : 'metal-box', ...(index % 3 === 0 ? {} : { propVariant: 'heavy-metal' as const }) })),
      ...Array.from({ length: 8 }, (_, index): ObstacleDef => ({ x: 430, y: 820 - index * 235, w: 74, h: 96, kind: index % 3 === 1 ? 'attack-block' : 'metal-box', ...(index % 3 === 1 ? {} : { propVariant: 'heavy-metal' as const }) })),
      { x: 0, y: -760, w: 150, h: 28, kind: 'reflective-surface' },
      { x: 0, y: -260, w: 150, h: 28, kind: 'reflective-surface' },
      { x: 0, y: 260, w: 150, h: 28, kind: 'reflective-surface' },
      { x: 0, y: 760, w: 150, h: 28, kind: 'reflective-surface' },
    ],
    durationSec: 255,
    threat: 'severe',
    landmark: { name: 'Lobby 40', description: 'Every elevator opens here, including elevators that do not exist.', kind: 'rail-yard', accent: '#ff70d2' },
    unlock: { kind: 'clearArea', areaId: 'clockmouth-roundabout' },
    waves: [
      { fromSec: 0, toSec: 92, enemyId: 'nightcrawler', ratePerSec: 1.25, burst: 3, formation: 'file' },
      { fromSec: 38, toSec: 165, enemyId: 'crypt-spitter', ratePerSec: 0.58, burst: 2, formation: 'wall' },
      { fromSec: 82, toSec: 255, enemyId: 'lightless-prowler', ratePerSec: 0.76, burst: 2, formation: 'pincer' },
      { fromSec: 128, toSec: 255, enemyId: 'choir-wraith', ratePerSec: 0.16, burst: 2, formation: 'file' },
      { fromSec: 205, toSec: 255, enemyId: 'the-sire', ratePerSec: 0.04, burst: 1, hpMult: 1.25 },
    ],
  },
];
