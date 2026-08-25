import { blobRig, humanoidRig } from '@/game/sprites/rigs';
import type { AmbientKindDef } from '@/game/types';

/**
 * Background life that reacts to the player without being part of combat --
 * civilians scatter, cats sit until disturbed. Purely cosmetic: never
 * touched by collision/damage code.
 */
export const AMBIENT_KINDS: AmbientKindDef[] = [
  {
    id: 'civilian',
    name: 'Civilian',
    palette: {
      ink: '#0d0d10', body: '#6b7280', bodyDark: '#374151', accent: '#9ca3af',
      accentBright: '#e5e7eb', skin: '#a8785a', glow: '#9ca3af',
    },
    rig: humanoidRig({ height: 17, width: 8 }),
    speed: 18,
    fleeSpeedMult: 3.2,
    fleeRadius: 90,
  },
  {
    id: 'cat',
    name: 'Cat',
    palette: {
      ink: '#0d0d10', body: '#44403c', bodyDark: '#292524', accent: '#78716c',
      accentBright: '#d6d3d1', skin: '#44403c', glow: '#a8a29e',
    },
    rig: blobRig({ height: 7, width: 9 }),
    speed: 12,
    fleeSpeedMult: 4.5,
    fleeRadius: 60,
  },
];

export const AMBIENT_KINDS_BY_ID: Record<string, AmbientKindDef> = Object.fromEntries(
  AMBIENT_KINDS.map((k) => [k.id, k]),
);

export function getAmbientKind(id: string): AmbientKindDef {
  const found = AMBIENT_KINDS_BY_ID[id];
  if (!found) {
    throw new Error(`Unknown ambient kind: ${id}`);
  }
  return found;
}
