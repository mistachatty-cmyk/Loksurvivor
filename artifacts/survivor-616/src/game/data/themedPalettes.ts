import type { ThemedPaletteDef } from '@/game/types';

/**
 * Purchasable character/world color palettes for cosmetic customization.
 * Applied globally to affect character sprites, enemies, and environmental colors.
 */
export const THEMED_PALETTES: ThemedPaletteDef[] = [
  {
    id: 'default',
    name: 'Standard 616',
    description: 'The original Grand Rapids steel and concrete look.',
    cost: 0,
    owned: true,
    palette: {
      ink: '#1a1a1a',
      body: '#4a5568',
      bodyDark: '#2d3748',
      accent: '#ed8936',
      accentBright: '#f6ad55',
      skin: '#d4a574',
      glow: '#ff9800',
    },
  },
  {
    id: 'neon-night',
    name: 'Neon Night',
    description: 'Vibrant cyberpunk neon glow. Bright synthwave aesthetic.',
    cost: 150,
    palette: {
      ink: '#0a0e27',
      body: '#1a1a2e',
      bodyDark: '#0f0f1e',
      accent: '#00ff88',
      accentBright: '#00ffcc',
      skin: '#ff0099',
      glow: '#00ff88',
    },
  },
  {
    id: 'molten-lava',
    name: 'Molten Lava',
    description: 'Fiery reds and oranges. Heat-scorched volcanic palette.',
    cost: 150,
    palette: {
      ink: '#2a1a0a',
      body: '#8b3e2e',
      bodyDark: '#5a2820',
      accent: '#ff6b2c',
      accentBright: '#ffb347',
      skin: '#d4744a',
      glow: '#ff4500',
    },
  },
  {
    id: 'frozen-tundra',
    name: 'Frozen Tundra',
    description: 'Cool icy blues and whites. Arctic wasteland vibes.',
    cost: 150,
    palette: {
      ink: '#0a1a2a',
      body: '#3a5a7a',
      bodyDark: '#1a3a4a',
      accent: '#4fc3f7',
      accentBright: '#81d4fa',
      skin: '#b3e5fc',
      glow: '#00bcd4',
    },
  },
  {
    id: 'forest-twilight',
    name: 'Forest Twilight',
    description: 'Deep greens and purples. Enchanted woodland darkness.',
    cost: 150,
    palette: {
      ink: '#1a2a1a',
      body: '#2d5a2d',
      bodyDark: '#1a3a1a',
      accent: '#9c27b0',
      accentBright: '#ce93d8',
      skin: '#6e9e6e',
      glow: '#7b1fa2',
    },
  },
  {
    id: 'toxic-waste',
    name: 'Toxic Waste',
    description: 'Sickly yellows and greens. Radioactive hazard palette.',
    cost: 150,
    palette: {
      ink: '#1a2a0a',
      body: '#4a5a2a',
      bodyDark: '#2a3a1a',
      accent: '#ccff00',
      accentBright: '#ffff33',
      skin: '#9eff00',
      glow: '#7fff00',
    },
  },
  {
    id: 'royal-purple',
    name: 'Royal Purple',
    description: 'Deep purples and golds. Regal, majestic atmosphere.',
    cost: 200,
    palette: {
      ink: '#2a1a3a',
      body: '#4a2a6a',
      bodyDark: '#2a1a4a',
      accent: '#ffd700',
      accentBright: '#ffed4e',
      skin: '#c9a961',
      glow: '#9c27b0',
    },
  },
  {
    id: 'blood-moon',
    name: 'Blood Moon',
    description: 'Dark crimsons and blacks. Vampiric midnight aesthetic.',
    cost: 200,
    palette: {
      ink: '#0a0a0a',
      body: '#3a1a1a',
      bodyDark: '#1a0a0a',
      accent: '#cc0000',
      accentBright: '#ff3333',
      skin: '#8b3a3a',
      glow: '#660000',
    },
  },
  {
    id: 'sunset-beach',
    name: 'Sunset Beach',
    description: 'Warm pinks, oranges, and teals. Coastal paradise vibes.',
    cost: 150,
    palette: {
      ink: '#1a2a3a',
      body: '#5a6a4a',
      bodyDark: '#3a4a2a',
      accent: '#ff6b9d',
      accentBright: '#ffa5c7',
      skin: '#f0a0a0',
      glow: '#ff1493',
    },
  },
  {
    id: 'chrome-steel',
    name: 'Chrome Steel',
    description: 'Silvery grays and cool metallics. Industrial future tech.',
    cost: 200,
    palette: {
      ink: '#0a0a0a',
      body: '#505050',
      bodyDark: '#2a2a2a',
      accent: '#e0e0e0',
      accentBright: '#ffffff',
      skin: '#a0a0a0',
      glow: '#c0c0c0',
    },
  },
];

export const THEMED_PALETTES_BY_ID: Record<string, ThemedPaletteDef> = Object.fromEntries(
  THEMED_PALETTES.map((palette) => [palette.id, palette]),
);

export const DEFAULT_PALETTE_ID = 'default';

export function getThemePalette(id: string): ThemedPaletteDef | undefined {
  return THEMED_PALETTES_BY_ID[id];
}

export function getActivePalette(paletteId: string) {
  const palette = THEMED_PALETTES_BY_ID[paletteId];
  return palette?.palette ?? THEMED_PALETTES_BY_ID[DEFAULT_PALETTE_ID]?.palette;
}
