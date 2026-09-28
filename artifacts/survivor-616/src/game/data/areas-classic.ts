import type { AreaDef } from '@/game/types';
import { squadWave } from './authoring';

/**
 * Classic Mode: a single continuous 30-minute (1800s) survival session on
 * one static, hand-authored arena -- Vampire-Survivors-style, not the base
 * game's short 2-4 minute "clear this area" runs. There is no procedural
 * chunk streaming here (`endless` is deliberately omitted): the whole point
 * is one fixed map the player never leaves, with pressure escalating purely
 * through the wave table across the full half hour instead of through map
 * growth. This is a first pass with one area; more Classic Mode maps are
 * meant to be layered on the same way `-2x`/`-4x` tiers grew over time.
 */
export const AREAS_CLASSIC: AreaDef[] = [
  {
    id: 'monroe-strip-classic',
    name: 'Classic Survival — Monroe Strip',
    district: 'Classic Mode · 30 Minutes',
    description:
      'The same three blocks where every run starts, held for the long haul. No exits, no area clear -- just you, the storefronts, and thirty straight minutes of 616 getting louder. Level up, get stronger, and see if the build you build can outlast the night.',
    backdrop: 'art/street.jpeg',
    bounds: { w: 1100, h: 760 },
    ground: { base: '#141420', tile: '#1c1c2c', seam: '#0c0c14', glow: '#f0a848' },
    sky: 'clear',
    obstacles: [
      { x: -400, y: -220, w: 120, h: 60, kind: 'car' },
      { x: 310, y: -270, w: 70, h: 50, kind: 'dumpster' },
      { x: 75, y: 170, w: 120, h: 56, kind: 'car' },
      { x: -320, y: 245, w: 60, h: 60, kind: 'crate' },
      { x: 220, y: 305, w: 58, h: 58, kind: 'crate-breakable' },
      { x: 400, y: 145, w: 50, h: 50, kind: 'planter' },
      { x: -465, y: -100, w: 42, h: 48, kind: 'flora' },
      { x: 465, y: 270, w: 48, h: 44, kind: 'flora' },
      { x: -75, y: -50, w: 90, h: 30, kind: 'barrier' },
      { x: 430, y: -270, w: 58, h: 52, kind: 'barrel' },
      { x: -430, y: 85, w: 58, h: 64, kind: 'neon-sign' },
      { x: 145, y: -85, w: 48, h: 48, kind: 'fuse-box' },
      { x: -135, y: 305, w: 28, h: 30, kind: 'street-lamp' },
      { x: 0, y: -225, w: 96, h: 24, kind: 'cover' },
      { x: 270, y: 100, w: 54, h: 54, kind: 'reflective-surface' },
      { x: -35, y: 250, w: 64, h: 64, kind: 'metal-box', propVariant: 'heavy-metal' },
      { x: 365, y: 305, w: 112, h: 28, kind: 'bench', propVariant: 'fixed-bench' },
      { x: 110, y: -10, w: 72, h: 54, kind: 'pothole', pothole: { trigger: 'ground-shock' } },
      { x: -255, y: 140, w: 66, h: 50, kind: 'pothole', pothole: { trigger: 'stomp' } },
      { x: -185, y: -280, w: 34, h: 40, kind: 'trash-can' },
      { x: 50, y: -315, w: 30, h: 56, kind: 'mailbox' },
      { x: -320, y: -35, w: 18, h: 52, kind: 'parking-meter' },
      { x: 460, y: -60, w: 58, h: 64, kind: 'neon-sign' },
      { x: -460, y: 340, w: 50, h: 50, kind: 'planter' },
      { x: 220, y: -320, w: 60, h: 60, kind: 'crate' },
    ],
    durationSec: 1800,
    threat: 'severe',
    unlock: { kind: 'default' },
    waves: [
      // Phase 1 (0:00-2:30) -- gentle on-ramp, one weak enemy type at a time.
      { fromSec: 0, toSec: 150, enemyId: 'nightcrawler', ratePerSec: 0.6, burst: 1 },

      // Phase 2 (2:00-5:00) -- second weak type layers in, rate creeps up.
      { fromSec: 120, toSec: 300, enemyId: 'neon-leech', ratePerSec: 0.55, burst: 1 },
      { fromSec: 150, toSec: 300, enemyId: 'nightcrawler', ratePerSec: 0.9, burst: 1 },

      // Phase 3 (5:00-7:30) -- first mid-tier enemy, still low pressure.
      { fromSec: 300, toSec: 450, enemyId: 'ash-wisp', ratePerSec: 0.5, burst: 1 },
      { fromSec: 300, toSec: 450, enemyId: 'nightcrawler', ratePerSec: 1.1, burst: 2 },
      { fromSec: 330, toSec: 450, enemyId: 'neon-leech', ratePerSec: 0.7, burst: 1 },

      // Phase 4 (7:30-10:00) -- corner-cutter and bloodhound join, rate rising toward the minute-10 spike.
      { fromSec: 450, toSec: 600, enemyId: 'corner-cutter', ratePerSec: 0.55, burst: 1 },
      { fromSec: 450, toSec: 600, enemyId: 'bloodhound', ratePerSec: 0.35, burst: 1 },
      { fromSec: 470, toSec: 600, enemyId: 'ash-wisp', ratePerSec: 0.7, burst: 2 },
      { fromSec: 490, toSec: 600, enemyId: 'nightcrawler', ratePerSec: 1.3, burst: 2, hpMult: 1.1 },

      // Minute-10 spike (10:00) -- the "game just got serious" set-piece: a single
      // giant-tier crypt-bouncer arrival, low ratePerSec/burst:1, a real threat
      // but not lethal-on-sight.
      { fromSec: 600, toSec: 615, enemyId: 'crypt-bouncer', ratePerSec: 0.1, burst: 1, hpMult: 1.15 },

      // Phase 5 (10:00-12:30) -- pressure resumes and climbs past the spike.
      { fromSec: 600, toSec: 750, enemyId: 'corner-cutter', ratePerSec: 0.75, burst: 2, hpMult: 1.15 },
      { fromSec: 600, toSec: 750, enemyId: 'crypt-spitter', ratePerSec: 0.4, burst: 1 },
      { fromSec: 615, toSec: 750, enemyId: 'bloodhound', ratePerSec: 0.55, burst: 1, hpMult: 1.1 },
      { fromSec: 650, toSec: 750, enemyId: 'belfry-bat', ratePerSec: 0.6, burst: 2 },

      // Phase 6 (12:30-15:00) -- overlapping windows, multiple types active at once.
      { fromSec: 750, toSec: 900, enemyId: 'crypt-spitter', ratePerSec: 0.6, burst: 2, hpMult: 1.2 },
      { fromSec: 750, toSec: 900, enemyId: 'belfry-bat', ratePerSec: 0.85, burst: 2, hpMult: 1.15 },
      { fromSec: 770, toSec: 900, enemyId: 'bloodhound', ratePerSec: 0.75, burst: 2, hpMult: 1.2 },
      { fromSec: 800, toSec: 900, enemyId: 'corner-cutter', ratePerSec: 1.0, burst: 2, group: ['nightcrawler'], formation: 'wedge', hpMult: 1.25 },

      // Phase 7 (15:00-17:30) -- toughest regulars enter heavy rotation.
      { fromSec: 900, toSec: 1050, enemyId: 'bloodhound', ratePerSec: 0.95, burst: 2, hpMult: 1.35 },
      { fromSec: 900, toSec: 1050, enemyId: 'crypt-spitter', ratePerSec: 0.85, burst: 2, hpMult: 1.35 },
      { fromSec: 930, toSec: 1050, enemyId: 'belfry-bat', ratePerSec: 1.1, burst: 3, hpMult: 1.3 },
      { fromSec: 960, toSec: 1050, enemyId: 'crypt-bouncer', ratePerSec: 0.12, burst: 1, hpMult: 1.4 },

      // Phase 8 (17:30-20:00) -- full-faction squad arrival for a dramatic mid-late moment.
      squadWave({ fromSec: 1050, toSec: 1080, factionId: 'lockstep', ratePerSec: 0.3, burst: 2, hpMult: 1.35, formation: 'ring' }),
      { fromSec: 1050, toSec: 1200, enemyId: 'corner-cutter', ratePerSec: 1.15, burst: 3, hpMult: 1.45, group: ['bloodhound'], formation: 'pincer' },
      { fromSec: 1080, toSec: 1200, enemyId: 'crypt-spitter', ratePerSec: 1.0, burst: 2, hpMult: 1.45 },
      { fromSec: 1110, toSec: 1200, enemyId: 'belfry-bat', ratePerSec: 1.3, burst: 3, hpMult: 1.4 },

      // Phase 9 (20:00-22:30) -- hpMult climbing further, sustained multi-type pressure.
      { fromSec: 1200, toSec: 1350, enemyId: 'bloodhound', ratePerSec: 1.2, burst: 3, hpMult: 1.6 },
      { fromSec: 1200, toSec: 1350, enemyId: 'crypt-spitter', ratePerSec: 1.1, burst: 3, hpMult: 1.6, group: ['corner-cutter'], formation: 'wall' },
      { fromSec: 1230, toSec: 1350, enemyId: 'belfry-bat', ratePerSec: 1.5, burst: 3, hpMult: 1.5 },
      { fromSec: 1260, toSec: 1350, enemyId: 'crypt-bouncer', ratePerSec: 0.18, burst: 1, hpMult: 1.55 },

      // Phase 10 (22:30-25:00) -- second faction arrival, heaviest pre-finale rotation.
      squadWave({ fromSec: 1350, toSec: 1500, factionId: 'the-watch', ratePerSec: 0.35, burst: 1, hpMult: 1.6, formation: 'phalanx' }),
      { fromSec: 1350, toSec: 1500, enemyId: 'crypt-spitter', ratePerSec: 1.3, burst: 3, hpMult: 1.75, group: ['bloodhound', 'corner-cutter'], formation: 'crossfire' },
      { fromSec: 1380, toSec: 1500, enemyId: 'belfry-bat', ratePerSec: 1.7, burst: 4, hpMult: 1.65 },
      { fromSec: 1420, toSec: 1500, enemyId: 'crypt-bouncer', ratePerSec: 0.25, burst: 1, hpMult: 1.75 },

      // Finale (25:00-30:00) -- the heaviest sustained pressure in the table:
      // highest ratePerSec/burst/hpMult combination used anywhere here.
      { fromSec: 1500, toSec: 1800, enemyId: 'corner-cutter', ratePerSec: 2.2, burst: 5, hpMult: 2.3, group: ['bloodhound', 'crypt-spitter'], formation: 'vortex' },
      { fromSec: 1500, toSec: 1800, enemyId: 'belfry-bat', ratePerSec: 2.4, burst: 5, hpMult: 2.1 },
      { fromSec: 1560, toSec: 1800, enemyId: 'crypt-bouncer', ratePerSec: 0.4, burst: 2, hpMult: 2.0, formation: 'escort' },
      squadWave({ fromSec: 1620, toSec: 1800, factionId: 'lockstep', ratePerSec: 0.6, burst: 3, hpMult: 2.2, formation: 'wedge' }),
      { fromSec: 1700, toSec: 1800, enemyId: 'crypt-bouncer', ratePerSec: 0.5, burst: 2, hpMult: 2.3, formation: 'pincer' },
    ],
  },
];
