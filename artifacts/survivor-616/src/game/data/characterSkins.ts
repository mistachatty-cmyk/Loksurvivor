import type { CharacterDef, MetaState, SpritePalette } from '@/game/types';
import { CHARACTER_EPISODE_BY_CHARACTER_ID } from './episodes';
import { characterMasteryLevel, MASTERY_SKIN_LEVELS, type MasterySkinLevel } from './characterMastery';

export type CharacterSkinStyle = 'original' | 'nocturne' | 'countertone' | 'episode' | 'onyx' | 'ivory' | 'ascendant';

export interface CharacterSkinDef {
  id: string;
  characterId: string;
  name: string;
  description: string;
  style: CharacterSkinStyle;
  episodeRequired: boolean;
  /** Mastery level (see `data/characterMastery.ts`) required to equip this skin; omitted for skins with no mastery gate. */
  requiredMasteryLevel?: MasterySkinLevel;
  /**
   * False for the prestige milestone skins below: their colorway is a
   * deliberate, fixed reward (onyx/ivory/translucent-and-gold) and should
   * never be re-tinted by the global Artisan world palette. Every other
   * skin defaults to blendable when this is omitted.
   */
  blendWorldPalette?: boolean;
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

const MILESTONE_GOLD = '#d4af37';
const MILESTONE_GOLD_BRIGHT = '#f5dc86';

const MILESTONE_SKIN_INFO: Record<MasterySkinLevel, { style: CharacterSkinStyle; name: string; description: string }> = {
  100: { style: 'onyx', name: 'Onyx Vanguard', description: 'Black armor with a gold trim, earned at Mastery Level 100.' },
  500: { style: 'ivory', name: 'Ivory Sovereign', description: 'White armor with a gold trim, earned at Mastery Level 500.' },
  1000: { style: 'ascendant', name: 'Ascendant', description: 'A half-faded form wrapped in gold trim, earned at Mastery Level 1000.' },
};

/**
 * A fixed prestige colorway per milestone tier -- unlike `paletteVariant`
 * above, this deliberately ignores the character's own hue so every
 * fighter's Onyx/Ivory/Ascendant skin reads the same at a glance. The
 * Ascendant tier's `body`/`bodyDark`/`skin` are `rgba()` strings: canvas
 * `fillStyle` (see `drawPartsSlow` in `render/sprite.ts`) accepts any CSS
 * color, so this alone renders the silhouette genuinely translucent with
 * no renderer change, while the opaque gold `ink` keeps its trim/outline
 * solid (the outline is drawn from `palette.ink` before each part fills).
 */
function milestonePalette(base: SpritePalette, level: MasterySkinLevel): SpritePalette {
  if (level === 100) {
    return {
      ink: '#050506',
      body: '#131315',
      bodyDark: '#020203',
      accent: MILESTONE_GOLD,
      accentBright: MILESTONE_GOLD_BRIGHT,
      skin: mixColor(base.skin, '#161616', 0.4),
      glow: MILESTONE_GOLD_BRIGHT,
    };
  }
  if (level === 500) {
    return {
      ink: '#2b2617',
      body: '#f6f1e3',
      bodyDark: '#d9cfb2',
      accent: MILESTONE_GOLD,
      accentBright: '#ffe9a8',
      skin: mixColor(base.skin, '#ffffff', 0.3),
      glow: '#ffe9a8',
    };
  }
  return {
    ink: MILESTONE_GOLD_BRIGHT,
    body: 'rgba(226, 233, 255, 0.42)',
    bodyDark: 'rgba(180, 190, 230, 0.34)',
    accent: MILESTONE_GOLD,
    accentBright: '#fff8e0',
    skin: 'rgba(232, 226, 255, 0.4)',
    glow: '#fff3c4',
  };
}

export function getCharacterSkins(character: CharacterDef): CharacterSkinDef[] {
  const seed = [...character.id].reduce((total, letter) => total + letter.charCodeAt(0), 0);
  const variants: Array<Pick<CharacterSkinDef, 'style' | 'name' | 'description' | 'episodeRequired'>> = [
    { style: 'original', name: 'Original', description: 'The character’s authored street colors.', episodeRequired: false },
    { style: 'nocturne', name: 'Nocturne', description: 'A cool late-night version of the original signal.', episodeRequired: false },
    { style: 'countertone', name: 'Countertone', description: 'A loud complementary remix unique to this fighter.', episodeRequired: false },
    { style: 'episode', name: 'Afterstory', description: 'The personal colorway earned by completing this character’s episode.', episodeRequired: true },
  ];
  const personalSkins = variants.map((skin) => ({
    ...skin,
    id: characterSkinId(character.id, skin.style),
    characterId: character.id,
    palette: paletteVariant(character.palette, skin.style, seed),
  }));

  const milestoneSkins = MASTERY_SKIN_LEVELS.map((level): CharacterSkinDef => {
    const info = MILESTONE_SKIN_INFO[level];
    return {
      id: characterSkinId(character.id, info.style),
      characterId: character.id,
      name: info.name,
      description: info.description,
      style: info.style,
      episodeRequired: false,
      requiredMasteryLevel: level,
      blendWorldPalette: false,
      palette: milestonePalette(character.palette, level),
    };
  });

  return [...personalSkins, ...milestoneSkins];
}

export function getCharacterSkin(character: CharacterDef, skinId?: string): CharacterSkinDef {
  const skins = getCharacterSkins(character);
  return skins.find((skin) => skin.id === skinId) ?? skins[0]!;
}

type SkinUnlockContext = Pick<MetaState, 'devModeAllUnlocks' | 'completedEpisodeIds' | 'killsByCharacter'>;

/** Single source of truth for whether a skin can be equipped -- used by both save normalization and the skin-select action, so the two can never disagree. */
export function isCharacterSkinUnlocked(skin: CharacterSkinDef, meta: SkinUnlockContext): boolean {
  if (meta.devModeAllUnlocks) return true;
  if (skin.requiredMasteryLevel) return characterMasteryLevel(skin.characterId, meta) >= skin.requiredMasteryLevel;
  if (skin.episodeRequired) {
    const episode = CHARACTER_EPISODE_BY_CHARACTER_ID[skin.characterId];
    return Boolean(episode && meta.completedEpisodeIds.includes(episode.id));
  }
  return true;
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
  const skin = getCharacterSkin(character, skinId);
  const shouldBlend = blendWorld && skin.blendWorldPalette !== false;
  return worldPalette && shouldBlend ? blendSpritePalettes(skin.palette, worldPalette) : skin.palette;
}
