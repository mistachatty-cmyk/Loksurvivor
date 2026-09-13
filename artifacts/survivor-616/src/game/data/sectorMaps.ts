import type { CustomMap, CustomMapPlacement } from '@/game/types';

/**
 * Authored Sector Command battlegrounds.
 *
 * These are ordinary `CustomMap` records -- the exact shape the in-game map
 * editor produces -- so campaign maps and player-made maps go through one
 * converter (`customMapToArea`) and one renderer. The only difference is that
 * these ship in `data/` instead of living in `MetaState.customMaps`.
 *
 * That also means a player can open any of these in the editor later and
 * remix it, and that anything the editor can express, a mission can use.
 */

let placementSeq = 0;
/** Terse placement helper -- these maps are hand-authored and would be unreadable inline. */
const at = (
  assetId: string,
  category: CustomMapPlacement['category'],
  x: number,
  y: number,
  w = 60,
  h = 60,
): CustomMapPlacement => ({ id: `sector-p${(placementSeq += 1)}`, assetId, category, x, y, w, h });

const playerStart = (x: number, y: number) => at('spawn-point:player', 'spawn-point', x, y, 48, 48);
const hostileEntry = (x: number, y: number) => at('spawn-point:hostile', 'spawn-point', x, y, 48, 48);

export const SECTOR_MAPS: CustomMap[] = [
  {
    id: 'sector-map-loading-dock',
    name: 'Old Market Loading Dock',
    bounds: { w: 1100, h: 820 },
    groundAssetId: 'ground:old-market',
    landmarkAssetId: null,
    backdrop: 'art/street.jpeg',
    durationSec: 240,
    threat: 'rising',
    updatedAt: 0,
    placements: [
      playerStart(-420, 300),
      hostileEntry(430, -320),
      hostileEntry(430, 320),
      // A loading bay you can actually hold: two walls and a mouth.
      at('structure:barrier', 'structure', -120, -140, 150, 40),
      at('structure:barrier', 'structure', -120, 140, 150, 40),
      at('structure:crate', 'structure', 40, -60, 60, 60),
      at('structure:crate', 'structure', 40, 60, 60, 60),
      at('structure:dumpster', 'structure', -260, 0, 70, 60),
      at('structure:car-wreck', 'structure', 250, -180, 60, 70),
      at('structure:metal-box', 'structure', 250, 180, 64, 64),
      at('objective-marker:hold', 'objective-marker', -40, 0, 64, 64),
      at('enemy:nightcrawler', 'enemy', 380, -260, 40, 40),
      at('enemy:corner-cutter', 'enemy', 380, 260, 40, 40),
      at('encounter:bloodhound', 'encounter', 300, 0, 40, 40),
    ],
  },
  {
    id: 'sector-map-null-substation',
    name: 'Null Sector Substation',
    bounds: { w: 1300, h: 1000 },
    groundAssetId: 'ground:null-sector',
    landmarkAssetId: null,
    backdrop: 'art/cellar.jpeg',
    durationSec: 300,
    threat: 'high',
    updatedAt: 0,
    placements: [
      playerStart(0, 400),
      hostileEntry(-540, -400),
      hostileEntry(540, -400),
      hostileEntry(0, -440),
      // Three racks to break, arranged so you cannot cover all of them at once.
      at('objective-marker:destroy', 'objective-marker', -380, -120, 56, 56),
      at('objective-marker:destroy', 'objective-marker', 0, -220, 56, 56),
      at('objective-marker:destroy', 'objective-marker', 380, -120, 56, 56),
      at('structure:fuse-box', 'structure', -380, -40, 48, 48),
      at('structure:fuse-box', 'structure', 380, -40, 48, 48),
      at('structure:metal-box', 'structure', -180, 60, 64, 64),
      at('structure:metal-box', 'structure', 180, 60, 64, 64),
      at('structure:barrier', 'structure', 0, 180, 200, 34),
      at('structure:reflective-surface', 'structure', -520, 200, 50, 50),
      at('structure:reflective-surface', 'structure', 520, 200, 50, 50),
      at('enemy:packet-wraith', 'enemy', -480, -300, 40, 40),
      at('enemy:packet-wraith', 'enemy', 480, -300, 40, 40),
      at('encounter:null-spitter', 'encounter', 0, -340, 40, 40),
      at('encounter:firewall-brute', 'encounter', -260, -340, 40, 40),
    ],
  },
  {
    id: 'sector-map-rooftop-relay',
    name: 'Rooftop Relay',
    bounds: { w: 1200, h: 760 },
    groundAssetId: 'ground:rooftops',
    landmarkAssetId: null,
    backdrop: 'art/rooftops.jpeg',
    durationSec: 270,
    threat: 'severe',
    updatedAt: 0,
    placements: [
      playerStart(-480, 0),
      hostileEntry(500, -280),
      hostileEntry(500, 280),
      // A long roofline: the extraction is a walk, not a button.
      at('objective-marker:extract', 'objective-marker', 470, 0, 64, 64),
      at('objective-marker:escort', 'objective-marker', -120, -160, 56, 56),
      at('objective-marker:escort', 'objective-marker', 160, 160, 56, 56),
      at('structure:ac-unit', 'structure', -280, -180, 60, 60),
      at('structure:ac-unit', 'structure', -80, 120, 60, 60),
      at('structure:ac-unit', 'structure', 120, -120, 60, 60),
      at('structure:ac-unit', 'structure', 320, 160, 60, 60),
      at('structure:barrier', 'structure', 0, -280, 140, 40),
      at('structure:barrier', 'structure', 0, 280, 140, 40),
      at('structure:neon-sign', 'structure', 260, -260, 58, 64),
      at('enemy:belfry-bat', 'enemy', 440, -240, 40, 40),
      at('enemy:ash-wisp', 'enemy', 440, 240, 40, 40),
      at('encounter:crypt-spitter', 'encounter', 380, 0, 40, 40),
    ],
  },
  {
    // Tier 2 battleground. Built wide and open on purpose: the beacons are far
    // enough apart that you cannot stand on both, and the extraction sits at
    // the dark end of the yard so fog has something worth scouting.
    id: 'sector-map-northline-yard',
    name: 'Northline Freight Yard',
    bounds: { w: 1600, h: 1000 },
    groundAssetId: 'ground:northline-yard',
    landmarkAssetId: null,
    backdrop: 'art/street.jpeg',
    durationSec: 330,
    threat: 'severe',
    updatedAt: 0,
    placements: [
      playerStart(-640, 380),
      hostileEntry(680, -400),
      hostileEntry(680, 400),
      hostileEntry(0, -450),
      // Two beacons, deliberately apart: holding both is the whole problem.
      at('beacon:relay-beacon', 'beacon', -420, 40, 56, 56),
      at('beacon:repeater-beacon', 'beacon', 300, -220, 56, 56),
      // The far objective, past the freight rows.
      at('objective-marker:extract', 'objective-marker', 660, 380, 64, 64),
      at('objective-marker:hold', 'objective-marker', -60, 60, 64, 64),
      // Freight rows: cover, sight lines, and something for fog to hide.
      at('structure:barrier', 'structure', -220, -180, 180, 40),
      at('structure:barrier', 'structure', 60, -60, 180, 40),
      at('structure:barrier', 'structure', -60, 240, 180, 40),
      at('structure:barrier', 'structure', 360, 140, 180, 40),
      at('structure:dumpster', 'structure', -480, -260, 60, 60),
      at('structure:dumpster', 'structure', 480, -60, 60, 60),
      at('structure:street-lamp', 'structure', -200, 320, 30, 90),
      at('structure:street-lamp', 'structure', 240, -360, 30, 90),
      at('encounter:nightcrawler', 'encounter', 620, -380, 40, 40),
      at('encounter:corner-cutter', 'encounter', 620, 380, 40, 40),
      // Blackout at Northline hunts these; without the spawn the mission is
      // unwinnable, which `sectorMissions.test.ts` now enforces.
      at('encounter:crypt-bouncer', 'encounter', 0, -420, 40, 40),
    ],
  },
];

export const SECTOR_MAPS_BY_ID: Record<string, CustomMap> = Object.fromEntries(
  SECTOR_MAPS.map((map) => [map.id, map]),
);

export function getSectorMap(id: string): CustomMap {
  const found = SECTOR_MAPS_BY_ID[id];
  if (!found) throw new Error(`Unknown sector map id: ${id}`);
  return found;
}
