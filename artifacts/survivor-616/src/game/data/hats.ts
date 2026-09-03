import type { HatDef, HatStyle } from '@/game/types';

export const HATS: HatDef[] = [
  { id: 'no-hat', name: 'No Hat', description: 'Keep the signal clean.', cost: 0, tier: 'standard', style: 'none' },
  { id: 'midnight-topper', name: 'Midnight Topper', description: 'A crooked top hat hovering just above the static.', cost: 2, tier: 'uncommon', style: 'top-hat' },
  { id: 'sunwire-halo', name: 'Sunwire Halo', description: 'A bright ring that refuses to touch the head.', cost: 2, tier: 'uncommon', style: 'halo' },
  { id: 'block-crown', name: 'Block Crown', description: 'Three brass points for a very small kingdom.', cost: 3, tier: 'rare', style: 'crown' },
  { id: 'weather-satellite', name: 'Weather Satellite', description: 'A tiny dish sends impossible forecasts.', cost: 3, tier: 'rare', style: 'satellite' },
  { id: 'rainy-day', name: 'Rainy Day', description: 'A personal storm cloud with one polite bolt.', cost: 3, tier: 'rare', style: 'rain-cloud' },
  { id: 'safety-cone', name: 'Safety Cone', description: 'Caution: style event in progress.', cost: 2, tier: 'uncommon', style: 'cone' },
  { id: 'orbital-eye', name: 'Orbital Eye', description: 'An interested eye watches from a small orbit.', cost: 4, tier: 'legendary', style: 'orbital-eye' },
  { id: 'moth-cap', name: 'Moth Cap', description: 'A soft nocturnal cap with a little living light.', cost: 4, tier: 'legendary', style: 'moth-cap' },
];
export const HATS_BY_ID: Record<string, HatDef> = Object.fromEntries(HATS.map((hat) => [hat.id, hat]));
export const DEFAULT_HAT_ID = 'no-hat';
export function getHatStyle(id: string): HatStyle { return HATS_BY_ID[id]?.style ?? 'none'; }
