/**
 * Run events: short authored beats the Director drops into a run (a supply drop,
 * a rush-hour stampede). They are seeded from the run seed, never `w.rng`, so a
 * seeded run always gets the same beats and deterministic tests do not shift.
 *
 * Adding a beat means adding a record here plus one `case` in `updateRunEvents`
 * (world.ts). Beats unlock as the player clears maps (`unlockMaps`), so a new
 * player's first runs stay calm. See docs/EVENTS_AND_INTERACTIONS_PLAN.md.
 */

import { quirkHash } from '@/game/data/enemyQuirks';

export type RunEventId = 'supply-drop' | 'rush-hour';

export interface RunEventDef {
  id: RunEventId;
  name: string;
  /** Standard maps the player must have cleared before this beat can appear. */
  unlockMaps: number;
  /** Heads-up before anything happens, ms. */
  warnMs: number;
  /** How long the beat runs after the warning, ms. */
  activeMs: number;
  warnText: string;
  doneText: string;
}

export const RUN_EVENTS: RunEventDef[] = [
  {
    id: 'supply-drop',
    name: 'Supply drop',
    unlockMaps: 2,
    warnMs: 4000,
    activeMs: 14000,
    warnText: 'SUPPLY DROP INBOUND! Watch the sky',
    doneText: 'SUPPLY DROP SECURED',
  },
  {
    id: 'rush-hour',
    name: 'Rush-hour stampede',
    unlockMaps: 4,
    warnMs: 3500,
    activeMs: 4200,
    warnText: 'RUSH HOUR! Step into the gap',
    doneText: 'STAMPEDE DODGED',
  },
];

export const RUN_EVENTS_BY_ID: Record<RunEventId, RunEventDef> = Object.fromEntries(
  RUN_EVENTS.map((e) => [e.id, e]),
) as Record<RunEventId, RunEventDef>;

export interface ScheduledRunEvent {
  id: RunEventId;
  /** Run time (ms) the warning starts. */
  startMs: number;
}

/** First beat can start at this run time; later ones come one window apart. */
export const RUN_EVENT_FIRST_MS = 60_000;
export const RUN_EVENT_WINDOW_MS = 110_000;
const RUN_EVENT_JITTER_MS = 80_000;
export const MIN_MAPS_FOR_RUN_EVENTS = 2;

/** How many beats a run gets: none before 2 maps, then one more every 3 maps, max 4. */
export function runEventCount(mapsCleared: number): number {
  if (mapsCleared < MIN_MAPS_FOR_RUN_EVENTS) return 0;
  return Math.min(4, 1 + Math.floor((mapsCleared - MIN_MAPS_FOR_RUN_EVENTS) / 3));
}

/** Pure and seeded: same seed, maps and disabled list always give the same schedule. */
export function scheduleRunEvents(seed: number, mapsCleared: number, disabledIds: readonly string[] = []): ScheduledRunEvent[] {
  const pool = RUN_EVENTS.filter((e) => e.unlockMaps <= mapsCleared && !disabledIds.includes(e.id));
  const count = pool.length === 0 ? 0 : runEventCount(mapsCleared);
  const schedule: ScheduledRunEvent[] = [];
  for (let i = 0; i < count; i += 1) {
    const def = pool[Math.floor(quirkHash(seed, i, 71) * pool.length)]!;
    const startMs = RUN_EVENT_FIRST_MS + i * RUN_EVENT_WINDOW_MS + Math.floor(quirkHash(seed, i, 72) * RUN_EVENT_JITTER_MS);
    schedule.push({ id: def.id, startMs });
  }
  return schedule;
}
