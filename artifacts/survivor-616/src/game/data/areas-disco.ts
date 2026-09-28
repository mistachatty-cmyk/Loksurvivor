import type { AreaDef } from '@/game/types';
import { squadWave } from './authoring';

/**
 * Digital Disco: a bonus, standalone capstone area gated behind clearing the
 * whole 4x tier (see `areas-4x.ts`). Hidden dance floor that never got
 * unplugged, now running on a corrupted broadcast loop -- the Lockstep
 * Remix family (see `data/factions.ts`) calls it home. One area, exported
 * as an array for the same reason `areas-2x.ts`/`areas-4x.ts` are.
 */
export const AREAS_DISCO: AreaDef[] = [
  {
    id: 'digital-disco',
    name: 'Digital Disco',
    district: 'Bonus · Off the Grid',
    description:
      'A dance floor that never got the message to shut down. The mirror ball still turns, the parquet still shines, and something down here answers every strobe pulse with a cone of its own.',
    backdrop: 'art/cellar.jpeg',
    bounds: { w: 2200, h: 1600 },
    ground: { base: '#1a0b24', tile: '#2a1140', seam: '#0c0416', glow: '#ff2ec4' },
    sky: 'cyber-storm',
    obstacles: [
      { x: 0, y: 0, w: 90, h: 90, kind: 'reflective-surface' },
      { x: -420, y: -260, w: 58, h: 64, kind: 'neon-sign' },
      { x: 420, y: -260, w: 58, h: 64, kind: 'neon-sign' },
      { x: -420, y: 260, w: 58, h: 64, kind: 'neon-sign' },
      { x: 420, y: 260, w: 58, h: 64, kind: 'neon-sign' },
      { x: -220, y: -420, w: 56, h: 54, kind: 'reflective-surface' },
      { x: 220, y: -420, w: 56, h: 54, kind: 'reflective-surface' },
      { x: -220, y: 420, w: 56, h: 54, kind: 'reflective-surface' },
      { x: 220, y: 420, w: 56, h: 54, kind: 'reflective-surface' },
      { x: -640, y: 0, w: 112, h: 28, kind: 'bench', propVariant: 'fixed-bench' },
      { x: 640, y: 0, w: 112, h: 28, kind: 'bench', propVariant: 'fixed-bench' },
      { x: 0, y: -640, w: 112, h: 28, kind: 'bench', propVariant: 'fixed-bench' },
      { x: 0, y: 640, w: 112, h: 28, kind: 'bench', propVariant: 'fixed-bench' },
      { x: -560, y: -400, w: 60, h: 60, kind: 'crate' },
      { x: 560, y: -400, w: 60, h: 60, kind: 'crate' },
      { x: -560, y: 400, w: 60, h: 60, kind: 'crate' },
      { x: 560, y: 400, w: 60, h: 60, kind: 'crate' },
      { x: -820, y: -180, w: 50, h: 50, kind: 'planter' },
      { x: 820, y: -180, w: 50, h: 50, kind: 'planter' },
      { x: -820, y: 180, w: 50, h: 50, kind: 'planter' },
      { x: 820, y: 180, w: 50, h: 50, kind: 'planter' },
      { x: -900, y: 0, w: 48, h: 48, kind: 'fuse-box' },
      { x: 900, y: 0, w: 48, h: 48, kind: 'fuse-box' },
    ],
    durationSec: 240,
    threat: 'severe',
    discoveryId: 'mirrorball-frequency',
    unlock: { kind: 'clearArea', areaId: 'crystal-cellar-4x' },
    waves: [
      { fromSec: 0, toSec: 60, enemyId: 'discoball-marshal', ratePerSec: 1.1, burst: 2, hpMult: 1.1 },
      { fromSec: 20, toSec: 110, enemyId: 'strobe-fault', ratePerSec: 0.9, burst: 2, group: ['chromatic-hustler'], formation: 'wedge' },
      // Appears often and on its own so its per-spawn randomized traits/looks
      // (see traitRandomizer on 'kaleidoscope-fault' in data/enemies.ts) get
      // room to show off -- no two of these in one burst look quite alike.
      { fromSec: 35, toSec: 240, enemyId: 'kaleidoscope-fault', ratePerSec: 1.3, burst: 3 },
      // The whole family's debut entrance: every cousin, including the boss,
      // arrives together once for a mid-run ambush -- see "Spawning a larger
      // group" in CLAUDE.md. The boss then returns alone below for its real
      // set piece, not lost inside this burst.
      squadWave({ fromSec: 95, toSec: 96, factionId: 'lockstep-remix', ratePerSec: 1, burst: 1, formation: 'ring' }),
      { fromSec: 100, toSec: 240, enemyId: 'parquet-warden', ratePerSec: 0.5, burst: 2, hpMult: 1.2 },
      { fromSec: 120, toSec: 240, enemyId: 'chromatic-hustler', ratePerSec: 1.2, burst: 3, group: ['strobe-fault'], formation: 'pincer' },
      { fromSec: 150, toSec: 240, enemyId: 'discoball-marshal', ratePerSec: 0.9, burst: 2, group: ['parquet-warden'], formation: 'escort', hpMult: 1.3 },
      // Boss set piece: a single, solo, late-run spawn -- the same
      // low-ratePerSec / burst:1 convention `the-sire` and `Foreman Slab`
      // use, never mixed anonymously into a regular burst.
      { fromSec: 225, toSec: 226, enemyId: 'mirrorball-sovereign', ratePerSec: 1, burst: 1 },
    ],
  },
];
