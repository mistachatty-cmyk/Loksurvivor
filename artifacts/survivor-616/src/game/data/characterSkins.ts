import type { CharacterDef, SpritePalette } from '@/game/types';

export type CharacterSkinStyle = 'original' | 'nocturne' | 'countertone' | 'episode';

export interface CharacterSkinDef {
  id: string;
  characterId: string;
  name: string;
  description: string;
  style: CharacterSkinStyle;
  episodeRequired: boolean;
  palette: SpritePalette;
}

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

function parseHex(color: string): [number, number, number] {
  const hex = color.replace('#', '');
  if (hex.length !== 6) return [255, 255, 255];
  return [Number.parseInt(hex.slice(0, 2), 16), Number.parseInt(hex.slice(2, 4), 16), Number.parseInt(hex.slice(4, 6), 16)];
}

function mixColor(a: string, b: string, amount: number): string {
  const left = parseHex(a);
  const right = parseHex(b);
  const mixed = left.map((channel, index) => clampByte(channel + (right[index]! - channel) * amount));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function paletteVariant(base: SpritePalette, style: CharacterSkinStyle, seed: number): SpritePalette {
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
  return {
    ink: mixColor(base.ink, '#000000', 0.3),
    body: mixColor(base.body, hot, 0.34),
    bodyDark: mixColor(base.bodyDark, cool, 0.28),
    accent: mixColor(base.accentBright, hot, 0.46),
    accentBright: '#fff7d6',
    skin: mixColor(base.skin, '#ffffff', 0.12),
    glow: mixColor(base.glow, '#ffffff', 0.42),
  };
}

export function characterSkinId(characterId: string, style: CharacterSkinStyle): string {
  return `${characterId}:${style}`;
}

export function getCharacterSkins(character: CharacterDef): CharacterSkinDef[] {
  const seed = [...character.id].reduce((total, letter) => total + letter.charCodeAt(0), 0);
  const variants: Array<Pick<CharacterSkinDef, 'style' | 'name' | 'description' | 'episodeRequired'>> = [
    { style: 'original', name: 'Original', description: 'The character’s authored street colors.', episodeRequired: false },
    { style: 'nocturne', name: 'Nocturne', description: 'A cool late-night version of the original signal.', episodeRequired: false },
    { style: 'countertone', name: 'Countertone', description: 'A loud complementary remix unique to this fighter.', episodeRequired: false },
    { style: 'episode', name: 'Afterstory', description: 'The personal colorway earned by completing this character’s episode.', episodeRequired: true },
  ];
  return variants.map((skin) => ({
    ...skin,
    id: characterSkinId(character.id, skin.style),
    characterId: character.id,
    palette: paletteVariant(character.palette, skin.style, seed),
  }));
}

export function getCharacterSkin(character: CharacterDef, skinId?: string): CharacterSkinDef {
  const skins = getCharacterSkins(character);
  return skins.find((skin) => skin.id === skinId) ?? skins[0]!;
}

export function blendSpritePalettes(personal: SpritePalette, world: SpritePalette, amount = 0.42): SpritePalette {
  return {
    ink: mixColor(personal.ink, world.ink, amount * 0.55),
    body: mixColor(personal.body, world.body, amount),
    bodyDark: mixColor(personal.bodyDark, world.bodyDark, amount),
    accent: mixColor(personal.accent, world.accent, amount),
    accentBright: mixColor(personal.accentBright, world.accentBright, amount),
    skin: mixColor(personal.skin, world.skin, amount * 0.18),
    glow: mixColor(personal.glow, world.glow, amount),
  };
}

export function resolveCharacterCosmeticPalette(
  character: CharacterDef,
  skinId: string | undefined,
  worldPalette: SpritePalette | undefined,
  blendWorld: boolean,
): SpritePalette {
  const personal = getCharacterSkin(character, skinId).palette;
  return worldPalette && blendWorld ? blendSpritePalettes(personal, worldPalette) : personal;
}
