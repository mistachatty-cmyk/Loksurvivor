import type { CharacterDef, SpritePalette } from '@/game/types';
import { applyPaletteStyle, mixColor, seedFromId, type PaletteStyleId } from '@/game/sprites/paletteStyles';

export type CharacterSkinStyle = PaletteStyleId | 'episode' | 'ember-guard' | 'moon-runner';

export interface CharacterSkinDef {
  id: string;
  characterId: string;
  name: string;
  description: string;
  style: CharacterSkinStyle;
  episodeRequired: boolean;
  crewRequired?: number;
  palette: SpritePalette;
}

export { mixColor };

const UNIVERSAL_STYLES: readonly PaletteStyleId[] = ['original', 'nocturne', 'countertone', 'cel-broadcast', 'riso-print'];
const isUniversalStyle = (style: CharacterSkinStyle): style is PaletteStyleId => (UNIVERSAL_STYLES as readonly string[]).includes(style);

function paletteVariant(base: SpritePalette, style: CharacterSkinStyle, seed: number): SpritePalette {
  if (isUniversalStyle(style)) return applyPaletteStyle(base, style, seed);
  const cool = seed % 2 === 0 ? '#38bdf8' : '#a78bfa';
  const hot = seed % 3 === 0 ? '#fb7185' : seed % 3 === 1 ? '#fbbf24' : '#34d399';
  if (style === 'ember-guard') return {
    ink: mixColor(base.ink, '#1c0806', 0.5), body: mixColor(base.body, '#8e301e', 0.55),
    bodyDark: mixColor(base.bodyDark, '#301015', 0.55), accent: mixColor(base.accent, '#ffae51', 0.75),
    accentBright: '#fff1ca', skin: base.skin, glow: '#ffcc64',
  };
  if (style === 'moon-runner') return {
    ink: mixColor(base.ink, '#07132e', 0.5), body: mixColor(base.body, '#304f9e', 0.55),
    bodyDark: mixColor(base.bodyDark, '#0c1945', 0.55), accent: mixColor(base.accent, '#7ed9ff', 0.7),
    accentBright: '#e5f7ff', skin: base.skin, glow: '#a0bbff',
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
  const seed = seedFromId(character.id);
  const variants: Array<Pick<CharacterSkinDef, 'style' | 'name' | 'description' | 'episodeRequired' | 'crewRequired'>> = [
    { style: 'original', name: 'Original', description: 'The character’s authored street colors.', episodeRequired: false },
    { style: 'nocturne', name: 'Nocturne', description: 'A cool late-night version of the original look.', episodeRequired: false },
    { style: 'countertone', name: 'Countertone', description: 'A loud complementary remix unique to this fighter.', episodeRequired: false },
    { style: 'cel-broadcast', name: 'Cel Broadcast', description: 'A hand-inked anime rebroadcast — flat saturated color and a blown-out rim light.', episodeRequired: false },
    { style: 'riso-print', name: 'Riso Print', description: 'A two-color risograph poster run on warm paper, slightly misregistered.', episodeRequired: false },
    { style: 'episode', name: 'Afterstory', description: 'The personal colorway earned by completing this character’s episode.', episodeRequired: true },
    { style: 'ember-guard', name: 'Ember Guard', description: 'Earned by rescuing three crew. Warm copper and firelight.', episodeRequired: false, crewRequired: 3 },
    { style: 'moon-runner', name: 'Moon Runner', description: 'Earned by rescuing eight crew. Cool midnight and moonlight.', episodeRequired: false, crewRequired: 8 },
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

export function isCharacterSkinUnlocked(skin: CharacterSkinDef, crewCount: number, episodeComplete: boolean): boolean {
  return (!skin.episodeRequired || episodeComplete) && crewCount >= (skin.crewRequired ?? 0);
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
