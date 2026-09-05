import type { SpritePalette, WaveDef } from '@/game/types';
import { getFaction } from './factions';

/**
 * Shared content-authoring helpers. `data/*.ts` files are plain records by
 * design (see CLAUDE.md), but a handful of shapes -- palettes, and now
 * multi-enemy wave bursts -- repeat enough per record that a small builder
 * pays for itself. These are optional: a record can still be written out by
 * hand field-by-field, and existing records were left as-is rather than
 * mass-migrated.
 */

/** Every SpritePalette field except the three that usually just echo another. */
export interface PaletteSeed {
  ink: string;
  body: string;
  bodyDark: string;
  accent: string;
  /** Defaults to `accent` -- most palettes only need one bright highlight. */
  accentBright?: string;
  /** Defaults to `body` -- most non-humanoid rigs never show separate skin. */
  skin?: string;
  /** Defaults to `accent` -- glow is usually just the accent color re-used for lighting. */
  glow?: string;
}

/**
 * Fills in a full SpritePalette from the 4 colors that actually vary between
 * most characters/enemies. Pass `accentBright`/`skin`/`glow` explicitly when
 * a record wants them distinct (many do, especially humanoid characters with
 * visible skin tone) -- this only removes the need to repeat a color that
 * would otherwise just be copy-pasted from another field.
 */
export function palette(seed: PaletteSeed): SpritePalette {
  return {
    ink: seed.ink,
    body: seed.body,
    bodyDark: seed.bodyDark,
    accent: seed.accent,
    accentBright: seed.accentBright ?? seed.accent,
    skin: seed.skin ?? seed.body,
    glow: seed.glow ?? seed.accent,
  };
}

/**
 * Builds a WaveDef that spawns an entire faction roster (see `data/factions.ts`)
 * together, once per spawn tick. This is the ergonomic path to "a larger
 * group": the engine already multiplies `burst * (1 + group.length)` enemies
 * per tick (see `updateSpawning` in `engine/world.ts`) and places them with
 * `formation` when one is given -- squadWave just fills `enemyId`/`group`/
 * `faction` from the registry instead of listing enemy ids by hand and
 * risking a typo `factions.test.ts` won't catch (a `group` array built
 * manually isn't checked against anything).
 *
 * `burst` still means "how many *copies* of the whole roster per tick" --
 * a 3-enemy faction with `burst: 2` spawns 6 enemies per tick, not 2.
 */
export function squadWave(seed: {
  fromSec: number;
  toSec: number;
  factionId: string;
  ratePerSec: number;
  /** Copies of the whole roster spawned per tick. Defaults to 1. */
  burst?: number;
  hpMult?: number;
  formation?: WaveDef['formation'];
}): WaveDef {
  const faction = getFaction(seed.factionId);
  const [lead, ...rest] = faction.roster;
  if (!lead) {
    throw new Error(`Faction ${seed.factionId} has an empty roster`);
  }
  return {
    fromSec: seed.fromSec,
    toSec: seed.toSec,
    enemyId: lead,
    group: rest,
    ratePerSec: seed.ratePerSec,
    burst: seed.burst ?? 1,
    hpMult: seed.hpMult,
    formation: seed.formation,
    faction: faction.name,
  };
}
