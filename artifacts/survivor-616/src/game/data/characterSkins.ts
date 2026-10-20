import type { CharacterDef, PaletteEffectDef, SpritePalette } from '@/game/types';
import { applyPaletteStyle, mixColor, seedFromId, type PaletteStyleId } from '@/game/sprites/paletteStyles';

export type CharacterSkinStyle = PaletteStyleId | 'episode' | 'ember-guard' | 'moon-runner' | 'null-crowned' | 'solar-ascendant' | 'prism-overdrive';

export interface CharacterSkinDef {
  id: string;
  characterId: string;
  name: string;
  description: string;
  style: CharacterSkinStyle;
  episodeRequired: boolean;
  crewRequired?: number;
  totalKillsRequired?: number;
  tier?: 'ultimate';
  effect?: PaletteEffectDef;
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
  if (style === 'null-crowned') return {
    ink: mixColor(base.ink, '#050816', 0.74), body: mixColor(base.body, '#243263', 0.72),
    bodyDark: mixColor(base.bodyDark, '#10122d', 0.78), accent: mixColor(base.accentBright, '#a78bfa', 0.7),
    accentBright: '#f2eaff', skin: mixColor(base.skin, '#a5b4fc', 0.38), glow: '#75e7ff',
  };
  if (style === 'solar-ascendant') return {
    ink: mixColor(base.ink, '#221000', 0.7), body: mixColor(base.body, '#c16b12', 0.72),
    bodyDark: mixColor(base.bodyDark, '#5b2607', 0.72), accent: '#ffd34e',
    accentBright: '#fff8ce', skin: mixColor(base.skin, '#ffc46b', 0.32), glow: '#fff06b',
  };
  if (style === 'prism-overdrive') return {
    ink: mixColor(base.ink, '#12051f', 0.7), body: mixColor(base.body, '#53258e', 0.72),
    bodyDark: mixColor(base.bodyDark, '#211043', 0.76), accent: seed % 2 === 0 ? '#4df4d5' : '#ff62c7',
    accentBright: '#f4f5ff', skin: mixColor(base.skin, '#d6b3ff', 0.28), glow: seed % 2 === 0 ? '#ff64b5' : '#55e7ff',
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
  const variants: Array<Pick<CharacterSkinDef, 'style' | 'name' | 'description' | 'episodeRequired' | 'crewRequired' | 'totalKillsRequired' | 'tier' | 'effect'>> = [
    { style: 'original', name: 'Original', description: 'The character’s authored street colors.', episodeRequired: false },
    { style: 'nocturne', name: 'Nocturne', description: 'A cool late-night version of the original look.', episodeRequired: false },
    { style: 'countertone', name: 'Countertone', description: 'A loud complementary remix unique to this fighter.', episodeRequired: false },
    { style: 'cel-broadcast', name: 'Cel Broadcast', description: 'A hand-inked anime rebroadcast — flat saturated color and a blown-out rim light.', episodeRequired: false },
    { style: 'riso-print', name: 'Riso Print', description: 'A two-color risograph poster run on warm paper, slightly misregistered.', episodeRequired: false },
    { style: 'episode', name: 'Afterstory', description: 'The personal colorway earned by completing this character’s episode.', episodeRequired: true },
    { style: 'ember-guard', name: 'Ember Guard', description: 'Earned by rescuing three crew. Warm copper and firelight.', episodeRequired: false, crewRequired: 3 },
    { style: 'moon-runner', name: 'Moon Runner', description: 'Earned by rescuing eight crew. Cool midnight and moonlight.', episodeRequired: false, crewRequired: 8 },
    { style: 'null-crowned', name: 'Null-Crowned', description: 'An ultimate void-forged look. Unlocked after 616 lifetime defeats.', episodeRequired: false, totalKillsRequired: 616, tier: 'ultimate', effect: { kind: 'prism', label: 'Null crown', speed: 0.72, intensity: 0.82 } },
    { style: 'solar-ascendant', name: 'Solar Ascendant', description: 'A radiant championship finish. Unlocked after 6,160 lifetime defeats.', episodeRequired: false, totalKillsRequired: 6160, tier: 'ultimate', effect: { kind: 'wave', label: 'Solar crest', speed: 0.54, intensity: 0.82 } },
    { style: 'prism-overdrive', name: 'Prism Overdrive', description: 'A full-spectrum endgame finish. Unlocked after 16,160 lifetime defeats.', episodeRequired: false, totalKillsRequired: 16160, tier: 'ultimate', effect: { kind: 'pulse', label: 'Prism drive', speed: 1.1, intensity: 0.88 } },
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

export function isCharacterSkinUnlocked(skin: CharacterSkinDef, crewCount: number, episodeComplete: boolean, totalKills = 0): boolean {
  return (!skin.episodeRequired || episodeComplete)
    && crewCount >= (skin.crewRequired ?? 0)
    && totalKills >= (skin.totalKillsRequired ?? 0);
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
