/**
 * Shared procedural recolor engine, originally built for `characterSkins.ts`'s
 * player skins and extracted here so any rig (player, enemy, LokPet) can reuse
 * the same named-style presets instead of a one-off hand-picked recolor.
 * Deliberately excludes any progression-gated style (episode/crew unlocks
 * live in `characterSkins.ts` itself, since those don't make sense outside a
 * player character).
 */
import type { SpritePalette } from '@/game/types';

export type PaletteStyleId = 'original' | 'nocturne' | 'countertone' | 'cel-broadcast' | 'riso-print';

export const HEX_RE = /^#[0-9a-f]{6}$/i;

export const PALETTE_STYLE_IDS: PaletteStyleId[] = ['original', 'nocturne', 'countertone', 'cel-broadcast', 'riso-print'];

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

function parseHex(color: string): [number, number, number] {
  const hex = color.replace('#', '');
  if (hex.length !== 6) return [255, 255, 255];
  return [Number.parseInt(hex.slice(0, 2), 16), Number.parseInt(hex.slice(2, 4), 16), Number.parseInt(hex.slice(4, 6), 16)];
}

export function mixColor(a: string, b: string, amount: number): string {
  const left = parseHex(a);
  const right = parseHex(b);
  const mixed = left.map((channel, index) => clampByte(channel + (right[index]! - channel) * amount));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

/** Stable per-entity seed so the same id always generates the same look. */
export function seedFromId(id: string): number {
  return [...id].reduce((total, letter) => total + letter.charCodeAt(0), 0);
}

export function applyPaletteStyle(base: SpritePalette, style: PaletteStyleId, seed: number): SpritePalette {
  if (style === 'original') return { ...base };
  const cool = seed % 2 === 0 ? '#38bdf8' : '#a78bfa';
  const hot = seed % 3 === 0 ? '#fb7185' : seed % 3 === 1 ? '#fbbf24' : '#34d399';
  if (style === 'nocturne') return {
    ink: mixColor(base.ink, '#020617', 0.55),
    body: mixColor(base.body, '#101a38', 0.52),
    bodyDark: mixColor(base.bodyDark, '#020617', 0.62),
    accent: mixColor(base.accent, cool, 0.62),
    accentBright: mixColor(base.accentBright, '#e0f2fe', 0.48),
    skin: mixColor(base.skin, '#6b7280', 0.2),
    glow: mixColor(base.glow, cool, 0.68),
  };
  if (style === 'countertone') return {
    ink: mixColor(base.ink, hot, 0.18),
    body: mixColor(base.body, base.accent, 0.66),
    bodyDark: mixColor(base.bodyDark, '#151015', 0.35),
    accent: mixColor(base.accent, hot, 0.72),
    accentBright: mixColor(base.accentBright, '#ffffff', 0.58),
    skin: mixColor(base.skin, base.accentBright, 0.18),
    glow: mixColor(base.glow, hot, 0.6),
  };
  if (style === 'cel-broadcast') return {
    // Anime cel-shading: near-black ink lines, a flat saturated body, and a
    // blown-out white-hot rim light standing in for a specular highlight.
    ink: mixColor(base.ink, '#000000', 0.7),
    body: mixColor(base.accent, hot, 0.4),
    bodyDark: mixColor(base.bodyDark, base.ink, 0.5),
    accent: mixColor(hot, cool, 0.3),
    accentBright: '#ffffff',
    skin: mixColor(base.skin, '#fff4e0', 0.35),
    glow: mixColor(hot, '#ffffff', 0.25),
  };
  // 'riso-print': two flat offset-ink layers (cool + hot) over a warm paper
  // ground, with no true black and a slightly misregistered accent standing
  // in for a printer's registration drift.
  return {
    ink: mixColor(base.ink, hot, 0.3),
    body: mixColor('#f3ead6', cool, 0.45),
    bodyDark: mixColor(base.bodyDark, cool, 0.4),
    accent: mixColor(hot, '#f3ead6', 0.2),
    accentBright: mixColor(hot, '#ffffff', 0.3),
    skin: mixColor(base.skin, '#f3ead6', 0.4),
    glow: mixColor(cool, hot, 0.5),
  };
}
