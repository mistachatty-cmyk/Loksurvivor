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
    description: "616's own dark-and-amber system. Always owned, no purchase needed.",
    cost: 0,
  },
  {
    id: 'arcade',
    name: 'Arcade Cabinet',
    description:
      'A phosphor-terminal CRT look with a chrome frame around every panel. The first theme with swappable accent swatches.',
    cost: 500,
    swatches: [
      { id: 'phosphor-green', name: 'Phosphor Green', primaryHsl: '156 100% 62%' },
      { id: 'phosphor-amber', name: 'Amber Tube', primaryHsl: '36 100% 62%' },
      { id: 'phosphor-cyan', name: 'Cyan Scanline', primaryHsl: '193 100% 62%' },
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
