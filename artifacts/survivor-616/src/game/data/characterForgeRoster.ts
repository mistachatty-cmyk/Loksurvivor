/**
 * Reinterprets every hand-authored character through the Operator Forge's own
 * procedural engine (`operatorForge.ts`, unmodified) for the Forge's "616
 * Roster" -- a browsable set of Forge-regenerated starting points below the
 * Operators tab's creator. Nothing here changes a `CharacterDef`: its stats,
 * weapon, ultimate and in-run rig are untouched. A roster entry is just a
 * deterministic `OperatorDesign` the player can load into the creator and
 * edit from there, exactly like picking a species/flavor preset already works.
 *
 * Each character's forged look is biased toward its own authored palette (by
 * hue) so the reinterpretation still "rhymes" with the original instead of
 * reading as pure noise. Core species only -- guessing a faction race from a
 * character's free-text bio is unreliable, so that stays a manual edit in the
 * creator rather than something this mapping tries to infer.
 */
import { CHARACTERS } from '@/game/data/characters';
import { generateOperatorDesign, generatePalette, type OperatorDesign } from '@/game/data/operatorForge';
import type { CharacterDef } from '@/game/types';

/** 0-359, or 0 for a malformed/missing hex. */
function hexToHue(hex: string): number {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return 0;
  const r = Number.parseInt(clean.slice(0, 2), 16) / 255;
  const g = Number.parseInt(clean.slice(2, 4), 16) / 255;
  const b = Number.parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;
  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue *= 60;
  return hue < 0 ? hue + 360 : hue;
}

export interface RosterEntry {
  id: string;
  name: string;
  blurb: string;
  design: OperatorDesign;
}

/** Deterministic: the same character always forges the same starting design. */
export function forgeDesignForCharacter(character: CharacterDef): OperatorDesign {
  const generated = generateOperatorDesign(`roster:${character.id}`, { coreOnly: true });
  const hue = hexToHue(character.palette.accent);
  const paletteSpec = { ...generated.paletteSpec, hue };
  return { ...generated, paletteSpec, palette: generatePalette(paletteSpec) };
}

let cachedRoster: RosterEntry[] | null = null;

/** Every hand-authored character, forged. Pure and cheap enough to memoize once. */
export function getCharacterRoster(): RosterEntry[] {
  if (!cachedRoster) {
    cachedRoster = CHARACTERS.map((character) => ({
      id: character.id,
      name: character.name,
      blurb: character.tagline,
      design: forgeDesignForCharacter(character),
    }));
  }
  return cachedRoster;
}
