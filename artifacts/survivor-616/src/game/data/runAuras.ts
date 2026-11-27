import type { RunAuraDef, RunAuraStyle } from '@/game/types';

/**
 * Survivor-native procedural cosmetics. Every style is drawn by Canvas2D from
 * the active character palette, so the catalog needs no external art assets.
 */
export const RUN_AURAS: RunAuraDef[] = [
  {
    id: 'street-halo',
    name: 'Street Halo',
    description: 'The original soft pulse ring. Clean, readable, and always yours.',
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
    name: 'Rain Pulse',
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
  {
    id: 'tile-bloom',
    name: 'Tile Bloom',
    description: 'A small grid of pavement tiles lights up underfoot and blooms with every step.',
    cost: 3,
    tier: 'rare',
    style: 'tile-bloom',
  },
  {
    id: 'comet-trail',
    name: 'Comet Trail',
    description: 'A small bright comet orbits you with a fading six-point tail.',
    cost: 4,
    tier: 'legendary',
    style: 'comet-trail',
  },
  {
    id: 'furnace-orbit',
    name: 'Furnace Orbit',
    description: 'A low ring of foundry embers circles you, slower and heavier than the others.',
    cost: 4,
    tier: 'legendary',
    style: 'ember-orbit',
  },
  // Wild ones (2026-11-27).
  { id: 'black-hole', name: 'Event Horizon', description: 'A pocket black hole at your feet. Light spirals in, bends around the edge and never comes back.', cost: 5, tier: 'legendary', style: 'black-hole' },
  { id: 'prism-storm', name: 'Prism Storm', description: 'Shards of every colour whirl around you like a kaleidoscope someone dropped down the stairs.', cost: 5, tier: 'legendary', style: 'prism-storm' },
  { id: 'lightning-cage', name: 'Lightning Cage', description: 'Arcs crack between four floating pylons. Loud to look at, harmless to touch.', cost: 4, tier: 'legendary', style: 'lightning-cage' },
  // Peaceful ones (2026-11-27).
  { id: 'koi-pond', name: 'Koi Pond', description: 'Two koi circle slowly in a still pool that ripples when you walk.', cost: 3, tier: 'rare', style: 'koi-pond' },
  { id: 'firefly-meadow', name: 'Firefly Meadow', description: 'Soft fireflies drift up around you and blink on a summer-night rhythm.', cost: 3, tier: 'rare', style: 'firefly-meadow' },
  { id: 'sakura-drift', name: 'Sakura Drift', description: 'Pale petals fall around you and settle without a sound.', cost: 3, tier: 'rare', style: 'sakura-drift' },
];

export const RUN_AURAS_BY_ID: Record<string, RunAuraDef> = Object.fromEntries(
  RUN_AURAS.map((aura) => [aura.id, aura]),
);

export const DEFAULT_RUN_AURA_ID = 'street-halo';

export function getRunAuraStyle(id: string): RunAuraStyle {
  return RUN_AURAS_BY_ID[id]?.style ?? RUN_AURAS_BY_ID[DEFAULT_RUN_AURA_ID]!.style;
}
