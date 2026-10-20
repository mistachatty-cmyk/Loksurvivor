/**
 * What the page reveals when it breaks: the game's own top-down ground (Grand Rapids streets, neon grids),
 * drawn by `renderGroundLayer` from a SECOND world that is never stepped. The overlay's own world is a black,
 * page-sized arena, so the scenery needs a real area's art.
 *
 * Nearly every authored ground is very dark (base luma 5-23 of 255, tile 15-58; only small glows are bright), so
 * shown as-is it would be black on a dark page, which is exactly the "nothing visibly happened" bug this layer
 * exists to fix. The palette is therefore re-lit against the page: brightened (hue kept) for dark pages and kept
 * deep for light ones, with a rim colour that contrasts the page too. Pure and deterministic, so it is tested
 * under node without a DOM.
 */
import { AREAS } from '@/game/data/areas';
import { getCharacter } from '@/game/data/characters';
import { createWorld, type World } from '@/game/engine/world';
import type { AreaDef } from '@/game/types';
import { packRgba, type EdgePalette } from './reveal';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** What we know about the page, from computed colours only (no pixel readback). */
export interface PageLook {
  /** Perceived lightness of the page background, 0..255. */
  luma: number;
  /** -1 cool .. +1 warm, from the page's accent (link/heading) colour; 0 when unknown. */
  warmth: number;
}

export function luma(c: Rgb): number {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

/** Parse `rgb()/rgba()` as computed styles report them. Fully transparent colours return null. */
export function parseCssColor(input: string): Rgb | null {
  const m = /rgba?\(([^)]+)\)/.exec(input);
  if (!m) return null;
  const parts = (m[1] ?? '').split(/[ ,/]+/).filter(Boolean).map((p) => parseFloat(p));
  if (parts.length < 3 || parts.slice(0, 3).some((n) => !Number.isFinite(n))) return null;
  if (parts.length > 3 && (parts[3] ?? 1) <= 0.05) return null;
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return { r: clamp(parts[0]!), g: clamp(parts[1]!), b: clamp(parts[2]!) };
}

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(c: Rgb): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

/**
 * Scale a colour so its luma reaches `target`, keeping its hue. A small floor stops pure black from staying
 * black, and `maxScale` stops a nearly black colour from blowing up into noise.
 */
export function scaleToLuma(hex: string, target: number, maxScale = 12): string {
  const c = hexToRgb(hex);
  const current = Math.max(1, luma(c));
  const wanted = target / current;
  const s = Math.min(maxScale, Math.max(0.25, wanted));
  // Only a colour the scale cap could not lift (near-black) gets the small additive floor; the rest hits the target exactly.
  const floor = target > 40 && wanted > maxScale ? 6 : 0;
  return rgbToHex({ r: c.r * s + floor, g: c.g * s + floor, b: c.b * s + floor });
}

export type LiftMode = 'bright' | 'deep';

/** Re-light a ground palette for the page: bright floor on dark pages, deep floor on light pages. Seam and glow are kept. */
export function liftGround(ground: AreaDef['ground'], mode: LiftMode): AreaDef['ground'] {
  return mode === 'bright'
    ? { base: scaleToLuma(ground.base, 82), tile: scaleToLuma(ground.tile, 112), seam: ground.seam, glow: ground.glow }
    : { base: scaleToLuma(ground.base, 22, 1.4), tile: scaleToLuma(ground.tile, 34, 1.6), seam: ground.seam, glow: ground.glow };
}

export function pageLook(background: Rgb | null, accent: Rgb | null): PageLook {
  // A transparent body/html background is white in a browser.
  const bg = background ?? { r: 255, g: 255, b: 255 };
  const warmth = accent ? Math.max(-1, Math.min(1, (accent.r - accent.b) / 160)) : 0;
  return { luma: Math.round(luma(bg) * 100) / 100, warmth };
}

/** Pools of real area ids (checked to exist by a test), by what contrasts a page. Order is stable. */
const FOR_DARK_PAGES: Record<'warm' | 'cool' | 'neutral', string[]> = {
  warm: ['old-market', 'monroe-strip', 'clockmouth-roundabout'],
  cool: ['riverfront', 'bubbleWash', 'haven-of-the-bubs'],
  neutral: ['civic-plaza', 'the-loop', 'mirror-mile'],
};
const FOR_LIGHT_PAGES: Record<'warm' | 'cool' | 'neutral', string[]> = {
  warm: ['monroe-strip', 'old-market', 'flat-lot'],
  cool: ['lev-syndicate-spire', 'riverfront', 'northline-yard'],
  neutral: ['null-sector', 'civic-plaza', 'soul-foundry'],
};

export const SCENERY_AREA_IDS = [
  ...new Set([...Object.values(FOR_DARK_PAGES).flat(), ...Object.values(FOR_LIGHT_PAGES).flat()]),
];

/** Dark pages get bright floors, light pages get deep ones; mid-grey pages sit on the fence, so lean by lightness. */
export function liftModeFor(look: PageLook): LiftMode {
  return look.luma < 128 ? 'bright' : 'deep';
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic pick: same page look + seed always gives the same area, different sites vary within the right pool. */
export function pickSceneryArea(look: PageLook, seed = ''): string {
  const tone = look.warmth > 0.25 ? 'warm' : look.warmth < -0.25 ? 'cool' : 'neutral';
  const pool = (liftModeFor(look) === 'bright' ? FOR_DARK_PAGES : FOR_LIGHT_PAGES)[tone];
  return pool[hashSeed(seed) % pool.length]!;
}

/** Rim and shade colours that separate a hole from the page: a bright rim on dark pages, a near-black one on light pages. */
export function edgePaletteFor(look: PageLook, glowHex: string): EdgePalette {
  const glow = hexToRgb(glowHex);
  return look.luma < 128
    ? { rim: packRgba(Math.min(255, glow.r + 70), Math.min(255, glow.g + 70), Math.min(255, glow.b + 70), 235), shade: packRgba(0, 0, 0, 150), scorch: packRgba(0, 0, 0, 120) }
    : { rim: packRgba(8, 10, 18, 240), shade: packRgba(0, 0, 0, 130), scorch: packRgba(30, 24, 18, 120) };
}

export interface Scenery {
  areaId: string;
  world: World;
  edges: EdgePalette;
  ground: AreaDef['ground'];
}

export function findSceneryArea(areaId: string): AreaDef {
  return AREAS.find((a) => a.id === areaId) ?? AREAS[0]!;
}

/** Build the second world for a page. Never stepped; the caller copies `now`/`cycle` from the live world each frame. */
export function createScenery(look: PageLook, seed = ''): Scenery {
  const areaId = pickSceneryArea(look, seed);
  const base = findSceneryArea(areaId);
  const ground = liftGround(base.ground, liftModeFor(look));
  const area: AreaDef = { ...base, ground, obstacles: [], waves: [], musicEvents: undefined, rescueAllyId: undefined, endless: undefined };
  const foreman = getCharacter('foreman');
  const world = createWorld(area, foreman, foreman.stats, hashSeed(areaId) % 100000);
  return { areaId: base.id, world, edges: edgePaletteFor(look, ground.glow), ground };
}
