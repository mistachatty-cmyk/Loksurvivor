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
    codexLore: "Filed under a personality, not a role. Whatever runs the Directors keeps a seat open for however many more of these it decides to grow.",
    effect: { kind: 'none' },
  },
  {
    id: 'the-warden',
    name: 'The Warden',
    triggerAfterSec: 150,
    rerollIntervalSec: 55,
    chance: 0.1,
    directorModeChanceMult: 3,
    factionId: 'prism-choir',
    bossEnemyId: 'prism-warden',
    hpMult: 1.08,
    formation: 'ring',
    warningText: 'LOCKDOWN — the Warden has sealed the exits',
    victoryText: "The Warden's lock has broken",
    unlockId: 'the-warden',
    toggleLabel: 'Warden Cut',
    toggleDescription: 'The Warden accelerates every hostile arrival and toughens the whole cast.',
    codexLore: 'The Warden treats every street as a cellblock and every survivor as an escape in progress. Its cuts are crowded, bright, and built to close around you.',
    effect: { kind: 'spawnBias', spawnRateMult: 1.18, hpMult: 1.1 },
  },
  {
    id: 'the-promoter',
    name: 'The Promoter',
    triggerAfterSec: 165,
    rerollIntervalSec: 50,
    chance: 0.11,
    directorModeChanceMult: 3,
    factionId: 'high-roller-syndicate',
    bossEnemyId: 'marquee-reaper',
    hpMult: 1.12,
    formation: 'wedge',
    warningText: 'HOUSE LIGHTS — the Promoter just raised the stakes',
    victoryText: 'The Promoter has left the building',
    unlockId: 'the-promoter',
    toggleLabel: 'Promoter Cut',
    toggleDescription: 'The Promoter gives its favored High Rollers more room in every compatible wave.',
    codexLore: 'The Promoter does not want a fair fight. It wants a packed room, a bright marquee, and a survivor desperate enough to become the main event.',
    effect: { kind: 'factionFavor', favoredFactionId: 'high-roller-syndicate', spawnRateMult: 1.65 },
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
