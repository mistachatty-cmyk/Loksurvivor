import type { PrefabDef } from '@/game/types';

/**
 * Reusable clumps of props scattered into an arena by `AreaDef.randomPrefabs`.
 * Positions are rolled per run from the run's own seed, so a map's furniture is
 * never laid out the same way twice -- adding one is a record here, never a
 * change to the scatter code in `world.ts`.
 *
 * `aegis-slab` is null alloy: indestructible, immovable, and the only material
 * that stops projectiles outright, so every prefab built from it is a piece of
 * hard cover the player can actually plan around.
 */
export const PREFABS: PrefabDef[] = [
  {
    id: 'null-baffle',
    name: 'Null Baffle',
    weight: 3,
    radius: 130,
    parts: [
      { dx: -46, dy: 0, w: 26, h: 108, kind: 'aegis-slab' },
      { dx: 46, dy: 0, w: 26, h: 108, kind: 'aegis-slab' },
    ],
  },
  {
    id: 'null-shelter',
    name: 'Null Shelter',
    weight: 3,
    radius: 150,
    parts: [
      { dx: 0, dy: -52, w: 132, h: 24, kind: 'aegis-slab' },
      { dx: -58, dy: 6, w: 24, h: 90, kind: 'aegis-slab' },
      { dx: 58, dy: 6, w: 24, h: 90, kind: 'aegis-slab' },
      { dx: 0, dy: 0, w: 36, h: 44, kind: 'crate-breakable' },
    ],
  },
  {
    id: 'sealed-cache',
    name: 'Sealed Cache',
    weight: 2,
    radius: 130,
    parts: [
      { dx: -40, dy: -30, w: 26, h: 92, kind: 'aegis-slab' },
      { dx: 40, dy: -30, w: 26, h: 92, kind: 'aegis-slab' },
      // Armoured until someone cracks the seal by hand; then it is a one-hit bomb.
      { dx: 0, dy: 24, w: 38, h: 46, kind: 'gas-tank', sealed: true },
      { dx: 0, dy: -34, w: 34, h: 40, kind: 'crate-breakable' },
    ],
  },
  {
    id: 'tapped-fuel-run',
    name: 'Tapped Fuel Run',
    weight: 2,
    radius: 150,
    parts: [
      { dx: -70, dy: 0, w: 24, h: 118, kind: 'aegis-slab' },
      { dx: -8, dy: -22, w: 38, h: 46, kind: 'gas-tank' },
      { dx: 34, dy: 6, w: 38, h: 46, kind: 'gas-tank', sealed: true },
      { dx: -8, dy: 40, w: 38, h: 46, kind: 'gas-tank' },
    ],
  },
  {
    id: 'sentry-nook',
    name: 'Sentry Nook',
    weight: 2,
    radius: 140,
    parts: [
      { dx: 0, dy: -46, w: 116, h: 24, kind: 'aegis-slab' },
      { dx: 0, dy: 16, w: 58, h: 68, kind: 'attack-block' },
    ],
  },
  {
    id: 'slab-alley',
    name: 'Slab Alley',
    weight: 3,
    radius: 160,
    parts: [
      { dx: -60, dy: -40, w: 24, h: 96, kind: 'aegis-slab' },
      { dx: 60, dy: 40, w: 24, h: 96, kind: 'aegis-slab' },
      { dx: 0, dy: 0, w: 96, h: 24, kind: 'aegis-slab' },
      { dx: -60, dy: 70, w: 34, h: 40, kind: 'trash-can' },
    ],
  },
];

export const PREFABS_BY_ID: Record<string, PrefabDef> = Object.fromEntries(
  PREFABS.map((prefab) => [prefab.id, prefab]),
);
