import type { UIThemeDef } from '@/game/types';

export interface UiLook {
  themeId: string;
  swatchId?: string;
}

/**
 * Purchasable UI chrome themes for hideout/menu screens. Recolors run through
 * CSS custom properties (see `data-ui-theme` in ScreenLayout + src/index.css)
 * so gameplay rendering (RunScreen's canvas) is never touched by a theme swap.
 */
export const UI_THEMES: UIThemeDef[] = [
  {
    id: 'starter-beacon', name: 'Starter Beacon', tier: 'starter', starter: true,
    description: 'The welcoming 616 terminal: warm amber, clean cyan and a gentle broadcast glow.', cost: 0,
    swatches: [{ id: 'amber-boot', name: 'Amber Boot', primaryHsl: '32 95% 55%' }, { id: 'cyan-ping', name: 'Cyan Ping', primaryHsl: '188 96% 65%' }, { id: 'rose-key', name: 'Rose Key', primaryHsl: '344 90% 68%' }],
  },
  {
    id: 'tape-garden', name: 'Tape Garden', tier: 'standard', starter: true,
    description: 'Cassette-green foliage, hand-drawn lines, and a slow living glow around the hideout.', cost: 0,
    swatches: [{ id: 'fern-tape', name: 'Fern Tape', primaryHsl: '145 76% 58%' }, { id: 'orchid-loop', name: 'Orchid Loop', primaryHsl: '292 82% 70%' }, { id: 'pollen-gold', name: 'Pollen Gold', primaryHsl: '46 96% 62%' }],
  },
  {
    id: 'streetwave', name: 'Streetwave', tier: 'uncommon', starter: true,
    description: 'Wet pavement, radio blue and hot route lights with a subtle moving city-frequency sheen.', cost: 0,
    swatches: [{ id: 'route-amber', name: 'Route Amber', primaryHsl: '35 100% 60%' }, { id: 'rain-blue', name: 'Rain Blue', primaryHsl: '207 92% 68%' }, { id: 'seat-plum', name: 'Seat Plum', primaryHsl: '313 63% 68%' }],
  },
  {
    id: 'prism-block', name: 'Prism Block', tier: 'rare', starter: true,
    description: 'A rare-spectrum party set: sticker colors, prism flashes, and bold hand-painted panel edges.', cost: 0,
    swatches: [{ id: 'flyer-yellow', name: 'Flyer Yellow', primaryHsl: '50 100% 62%' }, { id: 'speaker-magenta', name: 'Speaker Magenta', primaryHsl: '326 100% 68%' }, { id: 'porch-teal', name: 'Porch Teal', primaryHsl: '166 88% 58%' }],
  },
  {
    id: 'crown-static', name: 'Crown Static', tier: 'legendary', starter: true,
    description: 'A legendary broadcast anomaly: deep violet, crown gold and controlled chromatic static.', cost: 0,
    swatches: [{ id: 'crown-gold', name: 'Crown Gold', primaryHsl: '47 100% 64%' }, { id: 'royal-violet', name: 'Royal Violet', primaryHsl: '274 100% 72%' }, { id: 'ice-static', name: 'Ice Static', primaryHsl: '192 100% 72%' }],
  },
  {
    id: 'midnight-reliquary', name: 'Midnight Reliquary', tier: 'legendary', hidden: true,
    description: 'A secret midnight archive where blue fire drifts across the panels and the interface breathes in slow light.', cost: 0,
    swatches: [{ id: 'blue-ember', name: 'Blue Ember', primaryHsl: '196 100% 70%' }, { id: 'moon-violet', name: 'Moon Violet', primaryHsl: '267 100% 76%' }, { id: 'relic-gold', name: 'Relic Gold', primaryHsl: '45 100% 68%' }],
  },
  {
    id: 'mirror-carnival', name: 'Mirror Carnival', tier: 'legendary', hidden: true,
    description: 'A secret reflective midway: color keeps folding through the chrome while every card catches a different glow.', cost: 0,
    swatches: [{ id: 'mirror-rose', name: 'Mirror Rose', primaryHsl: '337 100% 72%' }, { id: 'electric-mint', name: 'Electric Mint', primaryHsl: '167 100% 67%' }, { id: 'ultraviolet', name: 'Ultraviolet', primaryHsl: '278 100% 74%' }],
  },
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
      'A phosphor-terminal CRT look with a chrome frame around every panel and four broadcast-inspired swatches.',
    cost: 500,
    swatches: [
      { id: 'phosphor-green', name: 'Phosphor Green', primaryHsl: '156 100% 62%' },
      { id: 'phosphor-amber', name: 'Amber Tube', primaryHsl: '36 100% 62%' },
      { id: 'phosphor-cyan', name: 'Cyan Scanline', primaryHsl: '193 100% 62%' },
      { id: 'violet-signal', name: 'Violet Pulse', primaryHsl: '274 100% 70%' },
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
  {
    id: 'pothole-oracle',
    name: 'Pothole Oracle',
    description:
      'A cracked-concrete divination board: every menu looks like it was found under a streetlight after the rain.',
    cost: 1200,
    swatches: [
      { id: 'road-salt', name: 'Road Salt', primaryHsl: '52 100% 62%' },
      { id: 'wet-asphalt', name: 'Wet Asphalt', primaryHsl: '190 90% 70%' },
      { id: 'oil-slick', name: 'Oil Slick', primaryHsl: '316 100% 68%' },
      { id: 'warning-violet', name: 'Warning Violet', primaryHsl: '274 100% 70%' },
    ],
  },
  {
    id: 'mall-ghost',
    name: 'Mall Ghost',
    description:
      'Fluorescent signage, closed kiosks, and one vending machine that still remembers your name.',
    cost: 1600,
    swatches: [
      { id: 'fluorescent-lime', name: 'Fluorescent Lime', primaryHsl: '86 100% 68%' },
      { id: 'food-court-coral', name: 'Food Court Coral', primaryHsl: '12 100% 68%' },
      { id: 'aquarium-blue', name: 'Aquarium Blue', primaryHsl: '191 100% 68%' },
      { id: 'security-purple', name: 'Security Purple', primaryHsl: '286 100% 73%' },
    ],
  },
  {
    id: 'weather-radio',
    name: 'Weather Radio',
    description:
      'A forecast station from a parallel Grand Rapids: warning tones, radar sweeps, and a sky that never quite clears.',
    cost: 2000,
    swatches: [
      { id: 'radar-green', name: 'Radar Green', primaryHsl: '142 90% 58%' },
      { id: 'storm-warning', name: 'Storm Warning', primaryHsl: '4 100% 68%' },
      { id: 'lake-effect', name: 'Lake Effect', primaryHsl: '199 100% 70%' },
      { id: 'sunset-static', name: 'Sunset Static', primaryHsl: '24 100% 66%' },
    ],
  },
  {
    id: 'salvage-terminal',
    name: 'Salvage Terminal',
    description: 'Stamped steel panels, grease-pencil marks, and a workbench light that never quits.',
    cost: 2400,
    swatches: [
      { id: 'torch-orange', name: 'Torch Orange', primaryHsl: '24 100% 62%' },
      { id: 'welding-blue', name: 'Welding Blue', primaryHsl: '193 100% 68%' },
      { id: 'shop-lime', name: 'Shop Lime', primaryHsl: '87 90% 62%' },
    ],
  },
  {
    id: 'river-dawn',
    name: 'River Dawn',
    description: 'Cool water, pale concrete, and the first clean light after a long run.',
    cost: 2800,
    swatches: [
      { id: 'bridge-cyan', name: 'Bridge Cyan', primaryHsl: '187 92% 63%' },
      { id: 'dawn-peach', name: 'Dawn Peach', primaryHsl: '18 100% 72%' },
      { id: 'mist-violet', name: 'Mist Violet', primaryHsl: '259 88% 74%' },
    ],
  },
  {
    id: 'block-party',
    name: 'Block Party',
    description: 'Flyers, speaker lights, and bright hand-painted signs for a hideout that finally feels alive.',
    cost: 3200,
    swatches: [
      { id: 'speaker-magenta', name: 'Speaker Magenta', primaryHsl: '326 100% 68%' },
      { id: 'flyer-yellow', name: 'Flyer Yellow', primaryHsl: '50 100% 62%' },
      { id: 'porch-teal', name: 'Porch Teal', primaryHsl: '166 88% 58%' },
    ],
  },
  { id: 'signal-garden', name: 'Lumen Garden', description: 'Botanical field notes crossed with luminous radio diagrams.', cost: 3600, swatches: [{ id: 'fern-signal', name: 'Fern Glow', primaryHsl: '145 76% 58%' }, { id: 'orchid-band', name: 'Orchid Band', primaryHsl: '292 82% 70%' }, { id: 'pollen-gold', name: 'Pollen Gold', primaryHsl: '46 96% 62%' }] },
  { id: 'night-bus', name: 'Night Bus', description: 'Transit vinyl, dim route displays and rainy-window color.', cost: 4000, swatches: [{ id: 'route-amber', name: 'Route Amber', primaryHsl: '35 100% 60%' }, { id: 'transfer-blue', name: 'Transfer Blue', primaryHsl: '211 92% 68%' }, { id: 'seat-plum', name: 'Seat Plum', primaryHsl: '313 63% 68%' }] },
  { id: 'impossible-manual', name: 'Impossible Manual', description: 'A technical manual for machinery that never existed.', cost: 4400, swatches: [{ id: 'diagram-cyan', name: 'Diagram Cyan', primaryHsl: '188 94% 65%' }, { id: 'warning-rose', name: 'Warning Rose', primaryHsl: '347 92% 68%' }, { id: 'annotation-lime', name: 'Annotation Lime', primaryHsl: '83 88% 62%' }] },
];

export const UI_THEMES_BY_ID: Record<string, UIThemeDef> = Object.fromEntries(
  UI_THEMES.map((theme) => [theme.id, theme]),
);

export const DEFAULT_UI_THEME_ID = 'house';

export const STARTER_UI_THEME_IDS = UI_THEMES.filter((theme) => theme.starter).map((theme) => theme.id);
export const HIDDEN_UI_THEME_IDS = UI_THEMES.filter((theme) => theme.hidden).map((theme) => theme.id);

export function defaultSwatchId(themeId: string): string | undefined {
  return UI_THEMES_BY_ID[themeId]?.swatches?.[0]?.id;
}

/** Returns the deterministic order used by the hideout's "Roll the Look" control. */
export function uiLooksForOwnedThemeIds(ownedThemeIds: string[]): UiLook[] {
  const owned = new Set(ownedThemeIds);
  return UI_THEMES.filter((theme) => owned.has(theme.id)).flatMap((theme) => {
    if (!theme.swatches?.length) return [{ themeId: theme.id }];
    return theme.swatches.map((swatch) => ({ themeId: theme.id, swatchId: swatch.id }));
  });
}

export function uiLooksForThemeIds(themeIds: string[]): UiLook[] {
  return uiLooksForOwnedThemeIds(themeIds);
}
