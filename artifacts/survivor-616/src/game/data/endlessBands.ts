import type { EndlessBandDef, EndlessBandId } from '@/game/types';

/**
 * Radial distance bands for the endless route. The thresholds are deliberately
 * wide enough that a player can read the change before the next one arrives.
 */
export const ENDLESS_BANDS: EndlessBandDef[] = [
  {
    id: 'core',
    label: 'Core Neighborhood',
    shortLabel: 'CORE',
    thresholdPx: 0,
    accent: '#a7f3d0',
    ground: { base: '#101820', tile: '#162530', seam: '#091017', glow: '#4de1ff' },
    riskLabel: 'familiar streets',
    hazardLabel: 'clear lanes',
    enemyPool: ['nightcrawler', 'neon-leech'],
    eventTitle: 'No signal beyond the core',
    eventDescription: 'Keep moving until the city changes its shape.',
  },
  {
    id: 'floodwall',
    label: 'Floodwall Margins',
    shortLabel: 'FLOODWALL',
    thresholdPx: 900,
    accent: '#4de1ff',
    ground: { base: '#0a2027', tile: '#10313a', seam: '#061318', glow: '#35d0bb' },
    riskLabel: 'rising water',
    hazardLabel: 'surge channels',
    enemyPool: ['neon-leech', 'river-wraith', 'ash-wisp'],
    eventTitle: 'Floodwall cache',
    eventDescription: 'A sealed maintenance locker is broadcasting through the spray.',
  },
  {
    id: 'rail-shadow',
    label: 'Elevated Rail Shadows',
    shortLabel: 'RAIL SHADOW',
    thresholdPx: 2300,
    accent: '#ffd166',
    ground: { base: '#1b1712', tile: '#292216', seam: '#0c0a07', glow: '#f2b84b' },
    riskLabel: 'freight lanes',
    hazardLabel: 'railfall',
    enemyPool: ['ash-wisp', 'bloodhound', 'belfry-bat', 'bridge-lookout', 'corner-cutter'],
    eventTitle: 'Signal box 616',
    eventDescription: 'Cross the live rail shadow for a chance at a locked signal cache.',
  },
  {
    id: 'industrial-fringe',
    label: 'Abandoned Industrial Fringe',
    shortLabel: 'FRINGE',
    thresholdPx: 3800,
    accent: '#fb923c',
    ground: { base: '#1d1714', tile: '#2d211b', seam: '#0d0a08', glow: '#f97316' },
    riskLabel: 'hot machinery',
    hazardLabel: 'foundry sparks',
    enemyPool: ['bloodhound', 'crypt-spitter', 'crypt-bouncer', 'lightless-prowler', 'spiral-moth'],
    eventTitle: 'Last loading dock',
    eventDescription: 'The abandoned line still has power — and something guarding the payout.',
  },
  {
    id: 'outer-threshold',
    label: 'Surreal Outer-City Threshold',
    shortLabel: 'THRESHOLD',
    thresholdPx: 5600,
    accent: '#c084fc',
    ground: { base: '#171323', tile: '#251b35', seam: '#0b0810', glow: '#b58cff' },
    riskLabel: 'reality shear',
    hazardLabel: 'anomaly bloom',
    enemyPool: [
      'lightless-prowler',
      'river-wraith',
      'bass-bruiser',
      'crypt-bouncer',
      'smoke-horn',
      'current-stag',
      'ring-scribe',
      'neon-comet',
    ],
    eventTitle: 'The city ends here',
    eventDescription: 'A door without a building offers one last dangerous shortcut.',
  },
];

export const ENDLESS_BANDS_BY_ID = Object.fromEntries(
  ENDLESS_BANDS.map((band) => [band.id, band]),
) as Record<EndlessBandId, EndlessBandDef>;

export function getEndlessBand(distancePx: number): EndlessBandDef {
  let selected = ENDLESS_BANDS[0]!;
  for (const band of ENDLESS_BANDS) {
    if (distancePx >= band.thresholdPx) selected = band;
    else break;
  }
  return selected;
}

export function endlessBandForChunk(cx: number, cy: number, chunkSize: number): EndlessBandDef {
  return getEndlessBand(Math.hypot(cx * chunkSize, cy * chunkSize));
}