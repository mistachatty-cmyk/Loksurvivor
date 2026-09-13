import type { SectorStructureDef } from '@/game/types';

/**
 * Tier 2 of the Sector Command economy: reinforcement beacons.
 *
 * Tier 1 (stolen) makes the wave itself the economy -- every unit is an enemy
 * you weakened and turned, so a squad wipe can end a run outright with no way
 * back. A beacon is the answer to that and nothing more: it trickles one basic
 * unit on a timer, so being wiped is a setback you play out of rather than a
 * dead run you restart.
 *
 * Two rules keep it from undoing Tier 1's tension:
 *  - A beacon never pushes you past the mission's `squadCap`. It refills, it
 *    does not inflate.
 *  - A beacon is mortal. Hostiles that reach it break it, and then the
 *    reinforcements stop -- so holding ground actually matters.
 *
 * Beacons are authored onto a map like any other placement (category
 * `beacon`), so the map editor can place them too.
 */
export const SECTOR_STRUCTURES: SectorStructureDef[] = [
  {
    id: 'relay-beacon',
    name: 'Choir Relay',
    description: 'A tapped street relay. Turns a stray Choir signal into a body every twelve seconds.',
    spawnIntervalSec: 12,
    unitEnemyId: 'nightcrawler',
    hp: 260,
  },
  {
    id: 'repeater-beacon',
    name: 'Null Repeater',
    description: 'Salvaged Null Sector hardware. Slower, but what it prints holds a line.',
    spawnIntervalSec: 18,
    unitEnemyId: 'corner-cutter',
    hp: 340,
  },
];

export const SECTOR_STRUCTURES_BY_ID: Record<string, SectorStructureDef> = Object.fromEntries(
  SECTOR_STRUCTURES.map((structure) => [structure.id, structure]),
);
