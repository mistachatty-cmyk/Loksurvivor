import type { SoundPackDef } from '@/game/types';

/**
 * Purchasable Sound Booth catalog. Mirrors `themedPalettes.ts` exactly: one
 * free default (`house-pa`, always owned), the rest priced in `lootTokens`
 * across the shared `CosmeticTier` scale. Each pack is only an `SfxStyleDef`
 * -- a handful of knobs that reskin every cue in `audio/sfxCues.ts`
 * uniformly, never a per-cue redefinition.
 */
export const SOUND_PACKS: SoundPackDef[] = [
  {
    id: 'house-pa',
    name: 'House PA',
    description: 'The Sanctum\'s own bar speakers. Plain, honest, and free.',
    cost: 0,
    owned: true,
    style: { pitchMult: 1, brightnessMult: 1, noiseMult: 1, decayMult: 1 },
  },
  {
    id: 'arcade-cabinet',
    name: 'Arcade Cabinet',
    description: 'Otis\'s back-room cabinets, dragged into every fight. Pure 8-bit square waves.',
    cost: 2,
    tier: 'uncommon',
    style: { waveOverride: 'square', pitchMult: 1.12, brightnessMult: 1.1, noiseMult: 0.6, decayMult: 0.8 },
  },
  {
    id: 'analog-warmth',
    name: 'Analog Warmth',
    description: 'Tape hiss and round, soft tones. Like the whole run is playing through a warm amp.',
    cost: 2,
    tier: 'uncommon',
    style: { waveOverride: 'sine', pitchMult: 0.92, brightnessMult: 0.85, noiseMult: 0.5, decayMult: 1.25 },
  },
  {
    id: 'neon-synthwave',
    name: 'Neon Synthwave',
    description: 'Bright sawtooth stabs lit up like the bridge at night.',
    cost: 3,
    tier: 'rare',
    style: { waveOverride: 'sawtooth', pitchMult: 1.05, brightnessMult: 1.25, noiseMult: 0.8, decayMult: 1.1 },
  },
  {
    id: 'basement-tape',
    name: 'Basement Tape',
    description: 'Cellar-muffled and grainy, like it\'s bleeding through the floor above.',
    cost: 3,
    tier: 'rare',
    style: { pitchMult: 0.8, brightnessMult: 0.7, noiseMult: 1.6, decayMult: 1.3 },
  },
  {
    id: 'chrome-impact',
    name: 'Chrome Impact',
    description: 'Hard, percussive, metallic. Every hit lands like a dropped wrench.',
    cost: 4,
    tier: 'legendary',
    style: { waveOverride: 'square', pitchMult: 0.75, brightnessMult: 1.3, noiseMult: 1.2, decayMult: 0.6 },
  },
  {
    id: 'vinyl-crate',
    name: 'Vinyl Crate',
    description: 'Crackly, warped-record warmth pulled from the record wall downstairs.',
    cost: 4,
    tier: 'legendary',
    style: { waveOverride: 'triangle', pitchMult: 0.95, brightnessMult: 0.95, noiseMult: 1.8, decayMult: 1.4 },
  },
];

export const SOUND_PACKS_BY_ID: Record<string, SoundPackDef> = Object.fromEntries(
  SOUND_PACKS.map((pack) => [pack.id, pack]),
);

export const DEFAULT_SOUND_PACK_ID = 'house-pa';

export function getSoundPack(id: string): SoundPackDef | undefined {
  return SOUND_PACKS_BY_ID[id];
}

export function getActiveSoundPackStyle(soundPackId: string) {
  return SOUND_PACKS_BY_ID[soundPackId]?.style ?? SOUND_PACKS_BY_ID[DEFAULT_SOUND_PACK_ID]!.style;
}
