import type { AreaDef } from '@/game/types';

/**
 * Explorable arenas. Each one owns its own layout, obstacle set, wave table
 * and unlock condition, so new districts are pure data.
 */
export const AREAS: AreaDef[] = [
  {
    id: 'monroe-strip',
    name: 'Monroe Strip',
    district: 'Downtown 616',
    description:
      'Three blocks of storefronts, a shuttered variety store and a streetlight that never quite commits. Where every run starts.',
    backdrop: 'art/street.jpeg',
    bounds: { w: 900, h: 620 },
    ground: { base: '#141420', tile: '#1c1c2c', seam: '#0c0c14', glow: '#f0a848' },
    obstacles: [
      { x: -320, y: -180, w: 120, h: 60, kind: 'car' },
      { x: 250, y: -220, w: 70, h: 50, kind: 'dumpster' },
      { x: 60, y: 140, w: 120, h: 56, kind: 'car' },
      { x: -260, y: 200, w: 60, h: 60, kind: 'crate' },
      { x: 180, y: 250, w: 58, h: 58, kind: 'crate-breakable' },
      { x: 330, y: 120, w: 50, h: 50, kind: 'planter' },
      { x: -60, y: -40, w: 90, h: 30, kind: 'barrier' },
      { x: 350, y: -220, w: 58, h: 52, kind: 'barrel' },
      { x: -350, y: 70, w: 58, h: 64, kind: 'neon-sign' },
      { x: 120, y: -70, w: 48, h: 48, kind: 'fuse-box' },
      { x: -110, y: 250, w: 28, h: 30, kind: 'street-lamp' },
    ],
    durationSec: 120,
    threat: 'low',
    rescueAllyId: 'vee',
    discoveryId: 'strip-mural',
    unlock: { kind: 'default' },
    waves: [
      { fromSec: 0, toSec: 40, enemyId: 'nightcrawler', ratePerSec: 1.1, burst: 1 },
      { fromSec: 18, toSec: 75, enemyId: 'neon-leech', ratePerSec: 0.8, burst: 2 },
      { fromSec: 45, toSec: 120, enemyId: 'nightcrawler', ratePerSec: 1.5, burst: 2, hpMult: 1.2 },
      { fromSec: 62, toSec: 120, enemyId: 'bloodhound', ratePerSec: 0.45, burst: 1 },
      { fromSec: 76, toSec: 120, enemyId: 'corner-cutter', ratePerSec: 0.42, burst: 1 },
      { fromSec: 95, toSec: 120, enemyId: 'crypt-bouncer', ratePerSec: 0.12, burst: 1 },
    ],
  },
  {
    id: 'back-alley',
    name: 'Fulton Back Alley',
    district: 'Behind the strip',
    description:
      'A brick corridor stacked with crates and fire escapes. Tight, loud, and the fastest place to get surrounded.',
    backdrop: 'art/alley.jpeg',
    bounds: { w: 620, h: 780 },
    ground: { base: '#12131c', tile: '#1a1b26', seam: '#090a10', glow: '#4de1ff' },
    obstacles: [
      { x: -220, y: -260, w: 70, h: 70, kind: 'crate' },
      { x: 210, y: -160, w: 70, h: 60, kind: 'dumpster' },
      { x: -200, y: 40, w: 60, h: 120, kind: 'crate' },
      { x: 200, y: 120, w: 60, h: 120, kind: 'crate' },
      { x: 0, y: 260, w: 110, h: 50, kind: 'barrier' },
      { x: -170, y: 300, w: 50, h: 50, kind: 'ac-unit' },
      { x: 160, y: -330, w: 50, h: 50, kind: 'ac-unit' },
      { x: 0, y: -300, w: 58, h: 52, kind: 'barrel' },
      { x: -40, y: 300, w: 60, h: 70, kind: 'car-wreck' },
    ],
    durationSec: 150,
    threat: 'rising',
    rescueAllyId: 'deacon',
    discoveryId: 'alley-hatch',
    unlock: { kind: 'clearArea', areaId: 'monroe-strip' },
    waves: [
      { fromSec: 0, toSec: 50, enemyId: 'neon-leech', ratePerSec: 1.3, burst: 2 },
      { fromSec: 12, toSec: 90, enemyId: 'nightcrawler', ratePerSec: 1.2, burst: 2, hpMult: 1.15 },
      { fromSec: 40, toSec: 150, enemyId: 'crypt-spitter', ratePerSec: 0.42, burst: 1 },
      { fromSec: 70, toSec: 150, enemyId: 'bloodhound', ratePerSec: 0.85, burst: 2 },
      { fromSec: 82, toSec: 150, enemyId: 'lightless-prowler', ratePerSec: 0.38, burst: 1 },
      { fromSec: 110, toSec: 150, enemyId: 'crypt-bouncer', ratePerSec: 0.2, burst: 1 },
    ],
  },
  {
    id: 'rooftops',
    name: 'Rooftop Line',
    district: 'Above Division',
    description:
      'Tar paper, vent stacks and a view of every light in the city. Open ground with nowhere to hide.',
    backdrop: 'art/rooftops.jpeg',
    bounds: { w: 1000, h: 560 },
    ground: { base: '#0f1119', tile: '#171a25', seam: '#080910', glow: '#ff7ab8' },
    obstacles: [
      { x: -380, y: 120, w: 60, h: 60, kind: 'ac-unit' },
      { x: -140, y: -140, w: 60, h: 60, kind: 'ac-unit' },
      { x: 180, y: 60, w: 60, h: 60, kind: 'ac-unit' },
      { x: 400, y: -120, w: 60, h: 60, kind: 'ac-unit' },
      { x: 20, y: 200, w: 140, h: 40, kind: 'barrier' },
      { x: -300, y: -200, w: 80, h: 40, kind: 'crate' },
      { x: 300, y: 190, w: 58, h: 64, kind: 'neon-sign' },
      { x: 40, y: -220, w: 28, h: 30, kind: 'street-lamp' },
    ],
    durationSec: 165,
    threat: 'high',
    rescueAllyId: 'nyx',
    discoveryId: 'skyline-tag',
    unlock: { kind: 'clearArea', areaId: 'back-alley' },
    waves: [
      { fromSec: 0, toSec: 60, enemyId: 'belfry-bat', ratePerSec: 2.1, burst: 3 },
      { fromSec: 20, toSec: 110, enemyId: 'ash-wisp', ratePerSec: 1.1, burst: 2 },
      { fromSec: 45, toSec: 165, enemyId: 'bloodhound', ratePerSec: 0.9, burst: 2, hpMult: 1.25 },
      { fromSec: 80, toSec: 165, enemyId: 'crypt-spitter', ratePerSec: 0.5, burst: 2 },
      { fromSec: 96, toSec: 165, enemyId: 'bridge-lookout', ratePerSec: 0.32, burst: 1 },
      { fromSec: 120, toSec: 165, enemyId: 'crypt-bouncer', ratePerSec: 0.3, burst: 1, hpMult: 1.2 },
    ],
  },
  {
    id: 'crystal-cellar',
    name: 'Crystal Cellar',
    district: 'Hidden room',
    description:
      'Down through the alley hatch: a cave of lantern light and glass growths that should not be under a city.',
    backdrop: 'art/cellar.jpeg',
    bounds: { w: 700, h: 700 },
    ground: { base: '#151208', tile: '#1e1a0e', seam: '#0b0904', glow: '#7ef0bd' },
    obstacles: [
      { x: -180, y: -180, w: 80, h: 80, kind: 'crate' },
      { x: 200, y: -120, w: 70, h: 90, kind: 'crate' },
      { x: -240, y: 160, w: 90, h: 70, kind: 'planter' },
      { x: 150, y: 220, w: 100, h: 60, kind: 'planter' },
      { x: 0, y: 0, w: 70, h: 70, kind: 'planter' },
      { x: 270, y: 40, w: 48, h: 48, kind: 'fuse-box' },
    ],
    durationSec: 150,
    threat: 'high',
    rescueAllyId: 'sable',
    discoveryId: 'lantern-shard',
    unlock: { kind: 'discovery', discoveryId: 'alley-hatch' },
    waves: [
      { fromSec: 0, toSec: 55, enemyId: 'ash-wisp', ratePerSec: 1.6, burst: 2 },
      { fromSec: 25, toSec: 100, enemyId: 'crypt-spitter', ratePerSec: 0.6, burst: 1 },
      { fromSec: 50, toSec: 150, enemyId: 'nightcrawler', ratePerSec: 1.6, burst: 3, hpMult: 1.4 },
      { fromSec: 90, toSec: 150, enemyId: 'crypt-bouncer', ratePerSec: 0.35, burst: 1, hpMult: 1.3 },
    ],
  },
  {
    id: 'bar-siege',
    name: 'Siege on the Sanctum',
    district: 'Home turf',
    description:
      'They found the hideout. Hold the bar floor until the last one drops -- The Sire comes personally.',
    backdrop: 'art/bar.jpeg',
    bounds: { w: 760, h: 620 },
    ground: { base: '#160f12', tile: '#20161a', seam: '#0c080a', glow: '#ffd45e' },
    obstacles: [
      { x: -240, y: -140, w: 160, h: 46, kind: 'barrier' },
      { x: 230, y: -160, w: 60, h: 60, kind: 'crate' },
      { x: 0, y: 180, w: 200, h: 46, kind: 'barrier' },
      { x: -260, y: 180, w: 60, h: 60, kind: 'crate' },
      { x: 250, y: 120, w: 60, h: 60, kind: 'planter' },
      { x: -20, y: -230, w: 58, h: 52, kind: 'barrel' },
      { x: 90, y: 40, w: 60, h: 70, kind: 'car-wreck' },
    ],
    durationSec: 180,
    threat: 'severe',
    rescueAllyId: 'mamajo',
    discoveryId: 'sire-ledger',
    unlock: { kind: 'clearArea', areaId: 'rooftops' },
    waves: [
      { fromSec: 0, toSec: 45, enemyId: 'nightcrawler', ratePerSec: 1.8, burst: 3, hpMult: 1.3 },
      { fromSec: 20, toSec: 90, enemyId: 'belfry-bat', ratePerSec: 1.8, burst: 3 },
      { fromSec: 40, toSec: 130, enemyId: 'bloodhound', ratePerSec: 1.1, burst: 2, hpMult: 1.4 },
      { fromSec: 60, toSec: 150, enemyId: 'crypt-spitter', ratePerSec: 0.7, burst: 2, hpMult: 1.3 },
      { fromSec: 78, toSec: 180, enemyId: 'bass-bruiser', ratePerSec: 0.24, burst: 1, hpMult: 1.2 },
      { fromSec: 90, toSec: 180, enemyId: 'crypt-bouncer', ratePerSec: 0.4, burst: 1, hpMult: 1.4 },
      { fromSec: 140, toSec: 141, enemyId: 'the-sire', ratePerSec: 1, burst: 1 },
    ],
  },
  {
    id: 'riverfront',
    name: 'Grand River Floodwall',
    district: 'West bank / 616',
    description:
      'Floodwall lanes, bridge ramps and wet concrete where the river cuts the city in half. Keep your footing.',
    backdrop: 'art/street.jpeg',
    bounds: { w: 1040, h: 660 },
    ground: { base: '#0c1820', tile: '#10242b', seam: '#071116', glow: '#35d0bb' },
    obstacles: [
      { x: -380, y: -210, w: 240, h: 34, kind: 'barrier' },
      { x: 380, y: -210, w: 240, h: 34, kind: 'barrier' },
      { x: -390, y: 210, w: 180, h: 44, kind: 'car-wreck' },
      { x: 300, y: 210, w: 150, h: 44, kind: 'barrier' },
      { x: -80, y: -220, w: 64, h: 64, kind: 'crate-breakable' },
      { x: 150, y: 120, w: 58, h: 58, kind: 'barrel' },
      { x: -260, y: 70, w: 54, h: 54, kind: 'street-lamp' },
      { x: 250, y: -70, w: 58, h: 64, kind: 'neon-sign' },
    ],
    durationSec: 175,
    threat: 'severe',
    rescueAllyId: 'sable',
    discoveryId: 'floodwall-mark',
    unlock: { kind: 'clearArea', areaId: 'rooftops' },
    waves: [
      { fromSec: 0, toSec: 55, enemyId: 'corner-cutter', ratePerSec: 1.0, burst: 2 },
      { fromSec: 18, toSec: 100, enemyId: 'river-wraith', ratePerSec: 0.48, burst: 1 },
      { fromSec: 38, toSec: 125, enemyId: 'bridge-lookout', ratePerSec: 0.52, burst: 1 },
      { fromSec: 68, toSec: 175, enemyId: 'lightless-prowler', ratePerSec: 0.72, burst: 2 },
      { fromSec: 92, toSec: 175, enemyId: 'river-wraith', ratePerSec: 0.8, burst: 2, hpMult: 1.25 },
      { fromSec: 130, toSec: 175, enemyId: 'bass-bruiser', ratePerSec: 0.32, burst: 1, hpMult: 1.35 },
    ],
  },

  // Endless mode -- no time limit, no walls, procedurally generated world.
  {
    id: 'endless-streets',
    name: 'Endless Streets',
    district: 'All of 616',
    description:
      'No walls. No clock. Walk any direction and the blocks keep going. Find the stairs down and see how deep the city goes.',
    backdrop: 'art/street.jpeg',
    bounds: { w: 99999, h: 99999 }, // not used directly -- world is unbounded
    ground: { base: '#141420', tile: '#1c1c2c', seam: '#0c0c14', glow: '#f0a848' },
    obstacles: [],
    durationSec: 0, // endless -- win condition is "head home", loss is death
    threat: 'rising',
    unlock: { kind: 'clearArea', areaId: 'monroe-strip' },
    waves: [], // spawning is procedural
    endless: true,
  },
];

export const AREAS_BY_ID: Record<string, AreaDef> = Object.fromEntries(
  AREAS.map((a) => [a.id, a]),
);

export function getArea(id: string): AreaDef {
  const found = AREAS_BY_ID[id];
  if (!found) {
    throw new Error(`Unknown area id: ${id}`);
  }
  return found;
}
