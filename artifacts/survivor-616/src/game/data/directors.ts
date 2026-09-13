import type { DirectorDef } from '@/game/types';

/**
 * Director events: a rare, data-driven mid-run escalation where a named
 * "Director" cuts in with its own unique squad. The engine (`updateDirector`
 * in `engine/world.ts`) only re-rolls `chance` on a timer and, on a hit,
 * spawns `factionId`'s whole roster (registered in `data/factions.ts`) via
 * the same formation/spawn machinery every other wave uses -- no bespoke
 * simulation logic. See "Spawning a larger group" in CLAUDE.md.
 *
 * Defeating `bossEnemyId` records a permanent unlock (`unlockId`) in
 * `MetaState.defeatedDirectorIds` / `directorModeUnlocked`, which surfaces
 * the `RunModifiers.directorModeEnabled` toggle on the Roster screen for
 * future runs.
 */
export const DIRECTORS: DirectorDef[] = [
  {
    id: 'take-two',
    name: 'The Director',
    triggerAfterSec: 180,
    rerollIntervalSec: 60,
    chance: 0.12,
    directorModeChanceMult: 3,
    factionId: 'reel-syndicate',
    bossEnemyId: 'the-director',
    hpMult: 1,
    formation: 'wedge',
    warningText: "CUT — someone's calling the shots now",
    victoryText: "That's a wrap on the Director",
    unlockId: 'take-two',
    toggleLabel: 'Director Mode',
    toggleDescription: 'Raises the odds the Director crashes a run with its crew, once eligible.',
  },
];

export const DIRECTORS_BY_ID: Record<string, DirectorDef> = Object.fromEntries(
  DIRECTORS.map((d) => [d.id, d]),
);

export function getDirector(id: string): DirectorDef {
  const found = DIRECTORS_BY_ID[id];
  if (!found) {
    throw new Error(`Unknown director id: ${id}`);
  }
  return found;
}
