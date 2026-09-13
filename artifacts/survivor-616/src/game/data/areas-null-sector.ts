import type { AreaDef } from '@/game/types';
import { escalatingWaves, squadWave } from './authoring';

/**
 * Null Sector: a decommissioned data-center basement corrupted by a rogue
 * signal. Deliberately breaks from the rest of 616's "cute fictionalized
 * Grand Rapids street" style -- cold cyan/magenta glitch accents on
 * near-black concrete, a huge maze-like layout instead of an open street,
 * and a 10-minute match structured around a repeating spawn-escalation
 * rhythm instead of a normal wave ramp. See .agents/memory/null-sector.md.
 *
 * World-unique mechanics (at least 5, per the design brief):
 * 1. `server-rack` obstacle -- the only area with this new breakable kind;
 *    bursts a small AoE on destruction (see world.ts damageBreakable).
 * 2. A large (2600x2600) maze layout: a radial "server ring" hub with four
 *    diagonal chicane corridors, unlike any other area's open-block layout.
 * 3. `ac-unit` obstacles reflavored as coolant conduits -- breaking one
 *    leaks a slowing coolant fluid tile (existing mechanic, new context).
 * 4. Unusual formation timing: `pincer`/`ring` formations on a cadence no
 *    other area uses, synced to the escalation cycle below.
 * 5. A 10-minute fixed match structured around `escalatingWaves()`: every
 *    30 seconds Packet Wraith's spawn rate climbs one step, four steps over
 *    2 minutes, then resets -- five full cycles across the match.
 * 6. A one-time "signal spike" at the match's halfway point: the whole Null
 *    Sector roster arrives together via `squadWave()`, arranged in a ring.
 */
export const AREAS_NULL_SECTOR: AreaDef[] = [
  {
    id: 'null-sector',
    name: 'Null Sector',
    district: 'Somewhere under all of it',
    description:
      'A server basement nobody built a door for. The racks have been dark for years. They are running something now.',
    backdrop: 'art/cellar.jpeg',
    bounds: { w: 2600, h: 2600 },
    ground: { base: '#0a0b10', tile: '#141522', seam: '#1fe6ff', glow: '#ff2fd0' },
    sky: 'roofed',
    landmark: {
      name: 'Server Atrium',
      description: 'A ring of dead racks, all humming, none of them plugged into anything.',
      kind: 'plaza',
      accent: '#1fe6ff',
    },
    obstacles: [
      // Central server ring -- 8 server-racks around the atrium hub.
      { x: 0, y: -220, w: 40, h: 70, kind: 'server-rack' },
      { x: 156, y: -156, w: 40, h: 70, kind: 'server-rack' },
      { x: 220, y: 0, w: 40, h: 70, kind: 'server-rack' },
      { x: 156, y: 156, w: 40, h: 70, kind: 'server-rack' },
      { x: 0, y: 220, w: 40, h: 70, kind: 'server-rack' },
      { x: -156, y: 156, w: 40, h: 70, kind: 'server-rack' },
      { x: -220, y: 0, w: 40, h: 70, kind: 'server-rack' },
      { x: -156, y: -156, w: 40, h: 70, kind: 'server-rack' },
      { x: 0, y: 0, w: 90, h: 90, kind: 'cover' },

      // Four diagonal chicane corridors -- alternating offset walls force
      // weaving instead of a straight run to any corner.
      { x: 420, y: -360, w: 70, h: 70, kind: 'metal-box', propVariant: 'heavy-metal' },
      { x: 560, y: -460, w: 140, h: 34, kind: 'barrier' },
      { x: 760, y: -560, w: 70, h: 70, kind: 'metal-box', propVariant: 'heavy-metal' },
      { x: 900, y: -700, w: 140, h: 34, kind: 'barrier' },
      { x: 1080, y: -820, w: 60, h: 60, kind: 'ac-unit' },

      { x: -420, y: -360, w: 70, h: 70, kind: 'metal-box', propVariant: 'heavy-metal' },
      { x: -560, y: -460, w: 140, h: 34, kind: 'barrier' },
      { x: -760, y: -560, w: 70, h: 70, kind: 'metal-box', propVariant: 'heavy-metal' },
      { x: -900, y: -700, w: 140, h: 34, kind: 'barrier' },
      { x: -1080, y: -820, w: 60, h: 60, kind: 'ac-unit' },

      { x: 420, y: 360, w: 70, h: 70, kind: 'metal-box', propVariant: 'heavy-metal' },
      { x: 560, y: 460, w: 140, h: 34, kind: 'barrier' },
      { x: 760, y: 560, w: 70, h: 70, kind: 'metal-box', propVariant: 'heavy-metal' },
      { x: 900, y: 700, w: 140, h: 34, kind: 'barrier' },
      { x: 1080, y: 820, w: 60, h: 60, kind: 'ac-unit' },

      { x: -420, y: 360, w: 70, h: 70, kind: 'metal-box', propVariant: 'heavy-metal' },
      { x: -560, y: 460, w: 140, h: 34, kind: 'barrier' },
      { x: -760, y: 560, w: 70, h: 70, kind: 'metal-box', propVariant: 'heavy-metal' },
      { x: -900, y: 700, w: 140, h: 34, kind: 'barrier' },
      { x: -1080, y: 820, w: 60, h: 60, kind: 'ac-unit' },

      // Dead-end alcoves at the far corners: a reflective-surface mirror
      // plus an armed attack-block, the highest-risk loot detour in the map.
      { x: 1150, y: -1150, w: 50, h: 50, kind: 'reflective-surface' },
      { x: 1150, y: -1050, w: 44, h: 44, kind: 'attack-block' },
      { x: -1150, y: -1150, w: 50, h: 50, kind: 'reflective-surface' },
      { x: -1150, y: -1050, w: 44, h: 44, kind: 'attack-block' },
      { x: 1150, y: 1150, w: 50, h: 50, kind: 'reflective-surface' },
      { x: 1150, y: 1050, w: 44, h: 44, kind: 'attack-block' },
      { x: -1150, y: 1150, w: 50, h: 50, kind: 'reflective-surface' },
      { x: -1150, y: 1050, w: 44, h: 44, kind: 'attack-block' },
    ],
    durationSec: 600,
    threat: 'severe',
    rescueAllyId: 'archivist',
    discoveryId: 'null-sector-log',
    unlock: { kind: 'clearArea', areaId: 'the-choir' },
    waves: [
      // Mechanic 5: escalating spawn-multiplier rhythm -- 4 steps per 120s
      // cycle, 5 cycles across the full 600s match.
      ...escalatingWaves({ enemyId: 'packet-wraith', baseRatePerSec: 0.4, matchLengthSec: 600, faction: 'Null Sector' }),
      // Flat baseline pressure underneath the escalation.
      { fromSec: 0, toSec: 600, enemyId: 'firewall-brute', ratePerSec: 0.12, burst: 1 },
      { fromSec: 60, toSec: 600, enemyId: 'null-spitter', ratePerSec: 0.18, burst: 1 },
      { fromSec: 120, toSec: 600, enemyId: 'corrupted-lookout', ratePerSec: 0.1, burst: 1 },
      // Mechanic 4: unusual formation timing -- drift-shard swarms arrive in
      // tight pincer bursts, a cadence no other area uses.
      { fromSec: 30, toSec: 570, enemyId: 'drift-shard', ratePerSec: 0.5, burst: 3, formation: 'pincer' },
      // Mechanic 6: the whole Null Sector roster arrives together once, at
      // the match's halfway point, ringed around the player.
      squadWave({ fromSec: 300, toSec: 301, factionId: 'null-sector', ratePerSec: 1, burst: 1, formation: 'ring' }),
    ],
  },
];
