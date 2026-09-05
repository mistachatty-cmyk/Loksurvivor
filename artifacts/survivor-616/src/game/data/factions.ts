/**
 * Named enemy rosters. A faction groups enemy ids that read as one crew --
 * the ids that already carried a matching `faction` string on their
 * `EnemyDef` are the roster here, not a new authored list, so this file is a
 * registry of what already exists rather than a second source of truth.
 *
 * Two things read a faction id:
 * - `factions.test.ts` checks every `EnemyDef.faction` string against this
 *   registry (and every roster id back against `ENEMIES`), so a typo in
 *   either direction fails the test suite instead of silently drifting.
 * - `squadWave()` in `authoring.ts` takes a faction id and spawns its whole
 *   roster together in one wave entry -- see "Spawning a larger group" in
 *   CLAUDE.md.
 *
 * A `WaveDef.faction` label (the string shown as a wave's flavor banner) is
 * looser -- it can name a faction not every enemy in that burst belongs to
 * (e.g. a corner-cutter burst labeled "Afterimage Choir" for mood). That's
 * fine and not checked here; this registry only governs `EnemyDef.faction`
 * and `squadWave()` rosters.
 */
export interface FactionDef {
  id: string;
  name: string;
  description: string;
  /** Color used for faction-flavored UI (wave banners, bestiary grouping). */
  accent: string;
  /** Enemy ids that belong to this faction, in the order squadWave() spawns them. */
  roster: string[];
}

export const FACTIONS: FactionDef[] = [
  {
    id: 'afterimage-choir',
    name: 'Afterimage Choir',
    description: 'Shadow-born flankers that never approach in a straight line.',
    accent: '#a78bfa',
    roster: ['spiral-moth', 'neon-comet'],
  },
  {
    id: 'cinder-procession',
    name: 'Cinder Procession',
    description: 'Armored chargers built from the east side fire that never fully went out.',
    accent: '#f43f5e',
    roster: ['smoke-horn'],
  },
  {
    id: 'river-antler-court',
    name: 'River Antler Court',
    description: 'Floodwall wildlife running sideways through the street grid.',
    accent: '#2dd4bf',
    roster: ['current-stag', 'ring-scribe'],
  },
  {
    id: 'bubblenaught-tide',
    name: 'Bubblenaught Tide',
    description: 'The native population of Haven of the Bubs, generations deep.',
    accent: '#38bdf8',
    roster: ['bubblenaught-drifter', 'bubblenaught-warden', 'marshal-undertow'],
  },
  {
    id: 'bubbleteer-parade',
    name: 'Bubbleteer Parade',
    description: "Bulbosa's line, crossing into the Bubblenaughts' kingdom same as her father did.",
    accent: '#f472b6',
    roster: ['bubbleteer-cadet', 'bubbleteer-shocker', 'captain-frothbite'],
  },
  {
    id: 'loop-chorus',
    name: 'Loop Chorus',
    description: 'Endless-mode ring runners that never learned to walk in a straight line.',
    accent: '#facc15',
    roster: ['ring-runner'],
  },
  {
    id: 'choir-of-twenty',
    name: 'Choir of Twenty',
    description: 'Twenty voices arrived singing and never stopped. See oddity-arenas.md.',
    accent: '#e9d8ff',
    roster: ['choir-wraith'],
  },
  {
    id: 'cabinet-rot',
    name: 'Cabinet Rot',
    description: 'The Neon Arcade cabinets, glitching back to life with nothing plugged in.',
    accent: '#ff2ec4',
    roster: ['pixel-wraith', 'token-golem', 'high-score-phantom', 'static-swarm', 'claw-machine-menace'],
  },
];

export const FACTIONS_BY_ID: Record<string, FactionDef> = Object.fromEntries(
  FACTIONS.map((f) => [f.id, f]),
);

export function getFaction(id: string): FactionDef {
  const found = FACTIONS_BY_ID[id];
  if (!found) {
    throw new Error(`Unknown faction id: ${id}`);
  }
  return found;
}
