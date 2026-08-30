import type { UIThemeDef } from '@/game/types';

/**
 * Purchasable UI chrome themes for hideout/menu screens. Recolors run through
 * CSS custom properties (see `data-ui-theme` in ScreenLayout + src/index.css)
 * so gameplay rendering (RunScreen's canvas) is never touched by a theme swap.
 */
export const UI_THEMES: UIThemeDef[] = [
  {
    id: 'house',
    name: 'House Style',
    description:
      "616's own dark-and-amber system. Always owned, with three palettes for the hideout and menus.",
    cost: 0,
    swatches: [
      { id: 'amber-standard', name: 'Amber Standard', primaryHsl: '32 95% 55%' },
      { id: 'lake-blue', name: 'Lake Blue', primaryHsl: '199 92% 62%' },
      { id: 'copper-rose', name: 'Copper Rose', primaryHsl: '348 92% 66%' },
    ],
  },
  {
    id: 'arcade',
    name: 'Arcade Cabinet',
    description:
      'A phosphor-terminal CRT look with a chrome frame around every panel and four signal-inspired swatches.',
    cost: 500,
    swatches: [
      { id: 'phosphor-green', name: 'Phosphor Green', primaryHsl: '156 100% 62%' },
      { id: 'phosphor-amber', name: 'Amber Tube', primaryHsl: '36 100% 62%' },
      { id: 'phosphor-cyan', name: 'Cyan Scanline', primaryHsl: '193 100% 62%' },
      { id: 'violet-signal', name: 'Violet Signal', primaryHsl: '274 100% 70%' },
    ],
  },
  {
    id: 'night-drive',
    name: 'Night Drive',
    description:
      'Midnight-blue surfaces with sodium-glow highlights. A slower, cinematic palette for late runs and quiet menus.',
    cost: 900,
    swatches: [
      { id: 'sodium-vapor', name: 'Sodium Vapor', primaryHsl: '39 100% 62%' },
      { id: 'blue-hour', name: 'Blue Hour', primaryHsl: '207 100% 68%' },
      { id: 'motel-pink', name: 'Motel Pink', primaryHsl: '326 100% 70%' },
    ],
  },
];

export const UI_THEMES_BY_ID: Record<string, UIThemeDef> = Object.fromEntries(
  UI_THEMES.map((theme) => [theme.id, theme]),
);

export const DEFAULT_UI_THEME_ID = 'house';

export function defaultSwatchId(themeId: string): string | undefined {
  return UI_THEMES_BY_ID[themeId]?.swatches?.[0]?.id;
}
