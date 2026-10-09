/**
 * Enemy quirks: random per-enemy effects rolled when an enemy spawns. Every
 * quirk lives here with its odds so the Bestiary chart is built from the same
 * records the engine rolls from -- add a record, and it shows up in both.
 */
export interface EnemyQuirkDef {
  id: string;
  name: string;
  /** What the player sees happen. */
  description: string;
  /** Relative odds among quirks. */
  weight: number;
  color: string;
  /** How it changes the fight, for the chart. */
  kind: 'stat' | 'movement' | 'defense' | 'death';
  /** What defeating one is worth beyond normal drops. */
  reward: string;
  /** What you gain when you "take on" the quirk yourself. */
  playerEffect: string;
}

export const ENEMY_QUIRKS: EnemyQuirkDef[] = [
  { id: 'frame-skip', name: 'Frame Skip', description: 'Every few seconds it skips forward a short hop toward you.', weight: 14, color: '#38bdf8', kind: 'movement', reward: 'Normal drops', playerEffect: 'Every 4 seconds, while moving, you hop 70 units ahead.' },
  { id: 'oversized', name: 'Oversized', description: 'Bigger, tougher and slower to knock around.', weight: 14, color: '#fb923c', kind: 'stat', reward: '1.5x XP', playerEffect: '+40% max health, but you are a 25% bigger target.' },
  { id: 'shrunken', name: 'Shrunken', description: 'Smaller and faster, with less health.', weight: 14, color: '#a3e635', kind: 'stat', reward: 'Normal drops', playerEffect: '+15% move speed and a 25% smaller target, but -25% max health.' },
  { id: 'volatile', name: 'Volatile', description: 'Detonates a ring where it falls a moment after it dies.', weight: 12, color: '#f87171', kind: 'death', reward: 'Normal drops', playerEffect: 'Enemies you defeat burst, hurting others within 90 units.' },
  { id: 'gilded', name: 'Gilded', description: 'Golden and sturdier. Drops a spill of extra cred.', weight: 8, color: '#facc15', kind: 'stat', reward: '3 extra cred drops', playerEffect: '12% of defeated enemies drop extra cred.' },
  { id: 'regenerating', name: 'Regenerating', description: 'Heals 3% of its health every second until it is hurt hard.', weight: 10, color: '#4ade80', kind: 'defense', reward: 'Normal drops', playerEffect: 'Heal 1.5% of max health every second.' },
  { id: 'spawn-shield', name: 'Spawn Shield', description: 'Cannot be damaged for its first 1.5 seconds.', weight: 8, color: '#93c5fd', kind: 'defense', reward: 'Normal drops', playerEffect: 'Your first hit every 15 seconds is blocked.' },
  { id: 'adrenaline', name: 'Adrenaline', description: 'Sprints at more than double speed for a second, every five.', weight: 10, color: '#f472b6', kind: 'movement', reward: 'Normal drops', playerEffect: 'Sprint at 2.4x speed for 1 second out of every 5.' },
  { id: 'flicker', name: 'Flicker', description: 'Blinks out of reach for half a second every few seconds.', weight: 6, color: '#c4b5fd', kind: 'defense', reward: 'Normal drops', playerEffect: 'You cannot be hurt for half a second every 4 seconds.' },
  { id: 'jitterbug', name: 'Jitterbug', description: 'Moves in unpredictable lateral jolts as it advances.', weight: 4, color: '#fde047', kind: 'movement', reward: 'Normal drops', playerEffect: '8% of hits miss you entirely.' },
];

export const ENEMY_QUIRKS_BY_ID: Record<string, EnemyQuirkDef> = Object.fromEntries(
  ENEMY_QUIRKS.map((quirk) => [quirk.id, quirk]),
);

/** Kills of enemies with a given quirk that unlock its "Everywhere" option. */
export const QUIRK_EVERYWHERE_KILLS = 1_000_000;
/** Kills of enemies with a given quirk that unlock "Take it on". */
export const QUIRK_TAKE_ON_KILLS = 2_500_000;

export const QUIRK_BASE_CHANCE = 0.06;
export const QUIRK_MAX_CHANCE = 0.14;
/** Run time at which the chance reaches its maximum. */
export const QUIRK_RAMP_MS = 600_000;

/** Chance that a freshly spawned enemy gets a quirk, `nowMs` into the run. */
export function quirkChance(nowMs: number): number {
  const ramp = Math.min(1, Math.max(0, nowMs) / QUIRK_RAMP_MS);
  return QUIRK_BASE_CHANCE + (QUIRK_MAX_CHANCE - QUIRK_BASE_CHANCE) * ramp;
}

/** Whether a given enemy can roll a quirk at all. */
export function canHaveQuirk(def: { family: string; sizeClass?: string }): boolean {
  return def.family !== 'Boss' && def.sizeClass !== 'boss' && def.sizeClass !== 'giant';
}

/** Deterministic 0..1 hash, so rolling never advances the run's seeded RNG. */
export function quirkHash(seed: number, uid: number, salt: number): number {
  let h = (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(uid | 0, 0x85ebca6b) ^ Math.imul(salt | 0, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Picks a quirk id for an enemy, or undefined for none. */
export function rollEnemyQuirk(
  def: { family: string; sizeClass?: string },
  nowMs: number,
  seed: number,
  uid: number,
  /** Quirks the player has switched off; the rest keep their relative odds. */
  disabled?: ReadonlySet<string>,
  /** Unlocked "Everywhere" quirks: every enemy, bosses included, gets one of these. */
  everywhere?: readonly string[],
): string | undefined {
  const forced = everywhere?.filter((id) => !disabled?.has(id) && ENEMY_QUIRKS.some((quirk) => quirk.id === id)) ?? [];
  if (forced.length > 0) return forced[Math.floor(quirkHash(seed, uid, 3) * forced.length)];
  if (!canHaveQuirk(def)) return undefined;
  const pool = disabled && disabled.size > 0 ? ENEMY_QUIRKS.filter((quirk) => !disabled.has(quirk.id)) : ENEMY_QUIRKS;
  if (pool.length === 0) return undefined;
  if (quirkHash(seed, uid, 1) >= quirkChance(nowMs)) return undefined;
  const total = pool.reduce((sum, quirk) => sum + quirk.weight, 0);
  let pick = quirkHash(seed, uid, 2) * total;
  for (const quirk of pool) {
    pick -= quirk.weight;
    if (pick < 0) return quirk.id;
  }
  return pool[pool.length - 1]!.id;
}

export interface QuirkChartRow {
  quirk: EnemyQuirkDef;
  /** Share of quirked enemies, 0..100. */
  sharePct: number;
  /** Chance that any one spawn is this quirk at the start of a run, 0..100. */
  startPct: number;
  /** Same, at the end of the ramp. */
  maxPct: number;
}

export function quirkChart(): QuirkChartRow[] {
  const total = ENEMY_QUIRKS.reduce((sum, quirk) => sum + quirk.weight, 0);
  return ENEMY_QUIRKS.map((quirk) => {
    const share = quirk.weight / total;
    return {
      quirk,
      sharePct: share * 100,
      startPct: share * QUIRK_BASE_CHANCE * 100,
      maxPct: share * QUIRK_MAX_CHANCE * 100,
    };
  });
}

/** Quirk Surge: once per run every spawn is quirked for a short window. */
export const QUIRK_SURGE_MS = 20_000;

/** Deterministic start of this run's surge, 90-210s in. */
export function quirkSurgeStart(seed: number): number {
  return 90_000 + Math.floor(quirkHash(seed, 0, 77) * 120_000);
}

/** Maps cleared before a Quirk Surge can start happening. */
export const QUIRK_SURGE_UNLOCK_MAPS = 14;
/** Chance a run has a surge before the end game fully unlocks it. */
export const QUIRK_SURGE_CHANCE = 0.25;

export type QuirkSurgeMode = 'off' | 'chance' | 'always';

/**
 * How often the player's runs get a Quirk Surge:
 *  - fewer than 14 maps cleared: never
 *  - 14 maps cleared: a chance each run
 *  - end game reached and the surge switch on: every run
 */
export function quirkSurgeMode(mapsCleared: number, endgame: boolean, switchOn: boolean): QuirkSurgeMode {
  if (endgame && switchOn) return 'always';
  return mapsCleared >= QUIRK_SURGE_UNLOCK_MAPS ? 'chance' : 'off';
}

/** Whether this run's seed has a surge at all under the given mode. */
export function quirkSurgeScheduled(mode: QuirkSurgeMode, seed: number): boolean {
  if (mode === 'always') return true;
  return mode === 'chance' && quirkHash(seed, 0, 78) < QUIRK_SURGE_CHANCE;
}
