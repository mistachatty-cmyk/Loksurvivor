import type { RunAuraDef, RunAuraStyle } from '@/game/types';

/**
 * Survivor-native procedural cosmetics. Every style is drawn by Canvas2D from
 * the active character palette, so the catalog needs no external art assets.
 */
export const RUN_AURAS: RunAuraDef[] = [
  {
    id: 'street-halo',
    name: 'Street Halo',
    description: 'The original soft signal ring. Clean, readable, and always yours.',
    cost: 0,
    tier: 'standard',
    style: 'street-halo',
  },
  {
    id: 'radar-sweep',
    name: 'Radar Sweep',
    description: 'A rotating scan line and broken range rings track your position.',
    cost: 2,
    tier: 'uncommon',
    style: 'radar-sweep',
  },
  {
    id: 'ember-orbit',
    name: 'Ember Orbit',
    description: 'Three hot sparks circle your feet and flare while you move.',
    cost: 2,
    tier: 'uncommon',
    style: 'ember-orbit',
  },
  {
    id: 'rain-signal',
    name: 'Rain Signal',
    description: 'A private downpour of luminous dashes follows you through the city.',
    cost: 3,
    tier: 'rare',
    style: 'rain-signal',
  },
  {
    id: 'glitch-echo',
    name: 'Glitch Echo',
    description: 'Offset scan fragments stutter around your silhouette without hiding threats.',
    cost: 3,
    tier: 'rare',
    style: 'glitch-echo',
  },
  {
    id: 'mothlight',
    name: 'Mothlight',
    description: 'Tiny diamond lights drift around you like curious night moths.',
    cost: 4,
    tier: 'legendary',
    style: 'mothlight',
  },
];

export const RUN_AURAS_BY_ID: Record<string, RunAuraDef> = Object.fromEntries(
  RUN_AURAS.map((aura) => [aura.id, aura]),
);

export const DEFAULT_RUN_AURA_ID = 'street-halo';

export function getRunAuraStyle(id: string): RunAuraStyle {
  return RUN_AURAS_BY_ID[id]?.style ?? RUN_AURAS_BY_ID[DEFAULT_RUN_AURA_ID]!.style;
}
