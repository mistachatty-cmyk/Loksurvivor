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
  {
    id: 'bubble-duck',
    name: 'Bubble Duck',
    palette: {
      ink: '#0a1a26', body: '#7dd3fc', bodyDark: '#0369a1', accent: '#fde68a',
      accentBright: '#fffbeb', skin: '#38bdf8', glow: '#bae6fd',
    },
    rig: blobRig({ height: 8, width: 11, wings: true }),
    speed: 22,
    fleeSpeedMult: 3.0,
    fleeRadius: 70,
  },
  {
    id: 'drifting-bubble',
    name: 'Drifting Bubble',
    palette: {
      ink: '#0c1c2a', body: '#a5d8ff', bodyDark: '#5eb1ef', accent: '#e0f7ff',
      accentBright: '#ffffff', skin: '#a5d8ff', glow: '#cdefff',
    },
    rig: blobRig({ height: 9, width: 9 }),
    speed: 10,
    fleeSpeedMult: 1.4,
    fleeRadius: 40,
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
