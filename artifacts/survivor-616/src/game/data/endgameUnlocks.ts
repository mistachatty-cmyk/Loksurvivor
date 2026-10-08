/**
 * End-game unlocks: optional extras that arrive only after the player has
 * cleared every standard map once, and that can each be switched on or off.
 *
 * Nothing here changes an authored operator, and nothing here is on screen by
 * default: a feature is earned, then the player chooses whether to show it.
 *
 *  - Features: the Operator Forge workshop, the operator zoom viewer, and the
 *    faction races inside the Forge.
 *  - Custom slots: five places to keep an operator the player made, each earned
 *    in its own way (the gate is clearing every map once; most slots then ask
 *    for one more thing). A slot holds a modified version of a premade
 *    operator's kit. It is always an extra roster entry, never a replacement.
 *
 * Pure functions of a small progress snapshot, so they are cheap to test and
 * safe to evaluate inside the meta reducer.
 */
import { AREAS } from '@/game/data/areas';
import { AREAS_2X } from '@/game/data/areas-2x';
import { AREAS_4X } from '@/game/data/areas-4x';

/** The slice of the save the unlock rules read. */
export interface EndgameProgress {
  clearedAreaIds: string[];
  totalKills: number;
  rescuedAllyIds: string[];
  discoveryIds: string[];
  lokPetBattleWins: number;
}

export type EndgameFeatureId = 'forge' | 'inspector' | 'factionRaces' | 'foil' | 'aura' | 'weaponEvolutions';

export interface EndgameFeature {
  id: EndgameFeatureId;
  label: string;
  /** One line shown beside its switch. */
  blurb: string;
  /** What switching it needs the page reloaded for, if anything. */
  needsReload: boolean;
}

export const ENDGAME_FEATURES: EndgameFeature[] = [
  {
    id: 'weaponEvolutions',
    label: 'Endgame weapon evolutions',
    blurb: 'Allow the DigiFrog Lance and Digi-Tana Trinity to evolve when their weapon and passive recipes are complete. On by default once Victory Lap opens.',
    needsReload: false,
  },
  {
    id: 'forge',
    label: 'Operator Forge',
    blurb: 'A workshop for making your own operators, kept in your custom slots. Turning it off hides your custom operators from the roster (they stay saved).',
    needsReload: true,
  },
  {
    id: 'inspector',
    label: 'Zoom viewer',
    blurb: 'A magnifier on each roster tile that opens the operator at full size.',
    needsReload: false,
  },
  {
    id: 'factionRaces',
    label: 'Faction races',
    blurb: 'Adds the faction-themed races to the Forge race list. The core races stay either way.',
    needsReload: false,
  },
  {
    id: 'foil',
    label: 'Champion foil',
    blurb: 'A holographic foil sweep across your selected operator on the roster.',
    needsReload: false,
  },
  {
    id: 'aura',
    label: 'Glow aura',
    blurb: 'Every operator tile glows in that operator\'s own color.',
    needsReload: false,
  },
];

export const ENDGAME_FEATURE_IDS: EndgameFeatureId[] = ENDGAME_FEATURES.map((f) => f.id);

export interface CustomSlot {
  id: string;
  label: string;
  /** How it is earned, in player words (shown once the end game is reached). */
  how: string;
  /** Progress toward the slot's own goal beyond clearing every map. */
  goal?: (p: EndgameProgress) => { have: number; need: number };
}

export const CUSTOM_SLOTS: CustomSlot[] = [
  { id: 'slot-circuit', label: 'Full Circuit', how: 'Clear every standard map once.' },
  {
    id: 'slot-crowd', label: 'Crowd Control', how: 'Defeat 20,000 enemies in total.',
    goal: (p) => ({ have: p.totalKills, need: 20000 }),
  },
  {
    id: 'slot-roll-call', label: 'Roll Call', how: 'Rescue 15 allies.',
    goal: (p) => ({ have: p.rescuedAllyIds.length, need: 15 }),
  },
  {
    id: 'slot-field-notes', label: 'Field Notes', how: 'Find 18 discoveries.',
    goal: (p) => ({ have: p.discoveryIds.length, need: 18 }),
  },
  {
    id: 'slot-beast-master', label: 'Beast Master', how: 'Win 25 LokPet battles.',
    goal: (p) => ({ have: p.lokPetBattleWins, need: 25 }),
  },
];

export const CUSTOM_SLOT_IDS = CUSTOM_SLOTS.map((s) => s.id);
/** The most custom operators anyone can keep in slots. */
export const MAX_CUSTOM_SLOTS = CUSTOM_SLOTS.length;

const EXTREME_IDS: ReadonlySet<string> = new Set([...AREAS_2X, ...AREAS_4X].map((a) => a.id));

/**
 * The maps that count toward the end game: every timed map, so not the endless
 * modes (which have no finish line) and not the optional extreme 2x and 4x versions.
 */
export const STANDARD_MAPS = AREAS.filter((a) => !a.endless && !EXTREME_IDS.has(a.id));

export function mapsCleared(p: Pick<EndgameProgress, 'clearedAreaIds'>): { have: number; need: number } {
  const cleared = new Set(p.clearedAreaIds);
  return { have: STANDARD_MAPS.filter((a) => cleared.has(a.id)).length, need: STANDARD_MAPS.length };
}

/** True once every standard map has been cleared at least once. */
export function endgameReached(p: Pick<EndgameProgress, 'clearedAreaIds'>): boolean {
  const { have, need } = mapsCleared(p);
  return need > 0 && have >= need;
}

export function isSlotEarned(slot: CustomSlot, p: EndgameProgress): boolean {
  if (!endgameReached(p)) return false;
  if (!slot.goal) return true;
  const { have, need } = slot.goal(p);
  return have >= need;
}

/** Every unlock id (features and slots) the progress currently qualifies for. */
export function earnedEndgame(p: EndgameProgress): string[] {
  if (!endgameReached(p)) return [];
  return [...ENDGAME_FEATURE_IDS, ...CUSTOM_SLOTS.filter((s) => isSlotEarned(s, p)).map((s) => s.id)];
}

/** Unlock ids earned in `next` that `before` did not have. */
export function newlyEarned(before: EndgameProgress, next: EndgameProgress): string[] {
  const had = new Set(earnedEndgame(before));
  return earnedEndgame(next).filter((id) => !had.has(id));
}

export function featureById(id: string): EndgameFeature | undefined {
  return ENDGAME_FEATURES.find((f) => f.id === id);
}
export function slotById(id: string): CustomSlot | undefined {
  return CUSTOM_SLOTS.find((s) => s.id === id);
}

/* ------------------------------------------------------------------ */
/* The table of everything the end game opens                          */

export type EndgameUnlockCategory = 'gate' | 'feature' | 'slot' | 'weapons' | 'forge' | 'bestiary' | 'hideout';

export interface EndgameUnlockRow {
  id: string;
  name: string;
  category: EndgameUnlockCategory;
  /** How it is earned, in player words. */
  how: string;
  /** Why it is part of the end game. */
  why: string;
  /** Progress toward this row, when it has a number to show. */
  progress?: (p: EndgameProgress) => { have: number; need: number };
  /** Whether the row is open for this save. */
  open: (p: EndgameProgress) => boolean;
}

const gateRow: EndgameUnlockRow = {
  id: 'gate',
  name: 'Victory Lap',
  category: 'gate',
  how: 'Clear every standard map once (timed maps; not the endless modes and not the extreme 2x and 4x versions).',
  why: 'Proof you have seen the whole game. Everything below stays out of the way until then, so the early game is never crowded.',
  progress: (p) => mapsCleared(p),
  open: (p) => endgameReached(p),
};

/** Single source for the Endgame settings table and docs/endgame-unlocks.md. */
export const ENDGAME_UNLOCK_TABLE: EndgameUnlockRow[] = [
  gateRow,
  ...ENDGAME_FEATURES.map((f): EndgameUnlockRow => ({
    id: f.id,
    name: f.label,
    category: 'feature',
    how: 'Opens with Victory Lap. You switch it on or off in Endgame settings or the hideout Endgame dock.',
    why: f.blurb,
    open: (p) => endgameReached(p),
  })),
  ...CUSTOM_SLOTS.map((s): EndgameUnlockRow => ({
    id: s.id,
    name: `Custom slot: ${s.label}`,
    category: 'slot',
    how: s.id === 'slot-circuit' ? s.how : `${s.how} (after Victory Lap)`,
    why: 'Each slot keeps one operator you made. A slot is earned its own way, so a full roster of custom operators takes real play.',
    progress: s.goal,
    open: (p) => isSlotEarned(s, p),
  })),
  {
    id: 'grpd-endgame-weapons',
    name: 'Ten GRPD endgame weapons',
    category: 'weapons',
    how: 'Reach Victory Lap, then lifetime kills of 750,000 and 1,000,000 in turn for each weapon. Each stays off until you switch it on in the GRPD Armory.',
    why: 'A long tail of goals for players who have finished the map list, without raising anything for new players.',
    progress: (p) => ({ have: p.totalKills, need: 750000 }),
    open: (p) => endgameReached(p) && p.totalKills >= 750000,
  },
  {
    id: 'classic-look',
    name: 'Classic v1 look',
    category: 'forge',
    how: 'Open with the Operator Forge. Pick "Classic v1" on any design.',
    why: 'Lets a custom operator use the original plain build instead of the detailed v2 features.',
    open: (p) => endgameReached(p),
  },
  {
    id: 'custom-looks',
    name: 'Custom enemy and LokPet looks',
    category: 'forge',
    how: 'Open with the Operator Forge. Recolor an enemy or LokPet on its screen and save it.',
    why: 'Cosmetic only: stats, behavior and abilities never change. Each look has its own run switch plus one master switch.',
    open: (p) => endgameReached(p),
  },
  {
    id: 'custom-bestiary',
    name: 'Custom Bestiary',
    category: 'bestiary',
    how: 'Opens with Victory Lap as a second view in the Bestiary.',
    why: 'One place to see and switch your custom enemy and LokPet looks next to the real threats.',
    open: (p) => endgameReached(p),
  },
  {
    id: 'hideout-dock',
    name: 'Hideout Endgame dock',
    category: 'hideout',
    how: 'Opens with Victory Lap. Hide it with "Show Endgame dock in the hideout" in Endgame settings.',
    why: 'Quick switches and shortcuts without digging through Settings.',
    open: (p) => endgameReached(p),
  },
];
