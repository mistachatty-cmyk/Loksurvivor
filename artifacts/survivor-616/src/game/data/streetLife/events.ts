/**
 * Street events: short, seeded run beats for Endless that change the rules for a few seconds.
 *
 * An event is a record, not code. It combines a few effect primitives the engine already understands:
 * multipliers while it runs (`mods`), one-shot effects at the start (`freezeEnemiesMs`, `enemyHpMult`,
 * `healFraction`) and a token burst at the end (`endTokens`). To add one, append a `defineStreetEvent`.
 * Scheduling is pure and seeded, so a seeded run always gets the same beats.
 */

import { ringHash } from '@/game/data/ringRuns';

export interface StreetEventMods {
  /** Multiplies the fighter's movement speed. */
  playerSpeedMult?: number;
  /** Multiplies the damage the fighter deals. */
  damageMult?: number;
  /** Multiplies XP gained. */
  xpMult?: number;
  /** Multiplies cred gained from pickups and rings. */
  credMult?: number;
}

export interface StreetEventDef {
  id: string;
  name: string;
  /** Relative odds of being picked. */
  weight: number;
  durationMs: number;
  /** Banner text when it starts and when it ends. */
  startText: string;
  doneText: string;
  mods?: StreetEventMods;
  /** Freeze every enemy on screen for this long when it starts. */
  freezeEnemiesMs?: number;
  /** Multiply the health of every enemy on screen when it starts (below 1 makes them easier). */
  enemyHpMult?: number;
  /** Heal this share of max health when it starts. */
  healFraction?: number;
  /** Throw out a burst of Victory Tokens when it ends. */
  endTokens?: { count: number; luck: number };
  /** Color of the HUD label while it runs. */
  color: string;
}

export function defineStreetEvent(def: StreetEventDef): StreetEventDef {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(def.id)) throw new Error(`street event id must be kebab-case: ${def.id}`);
  if (!(def.weight > 0) || !(def.durationMs > 0)) throw new Error(`street event ${def.id}: weight and duration must be positive`);
  return def;
}

export const STREET_EVENTS: StreetEventDef[] = [
  defineStreetEvent({
    id: 'free-trial', name: 'Free trial', weight: 10, durationMs: 15000, color: '#ffd36b',
    startText: 'FREE TRIAL: weapons at full power', doneText: 'FREE TRIAL OVER',
    mods: { damageMult: 1.6, xpMult: 1.5 },
  }),
  defineStreetEvent({
    id: 'loading-screen', name: 'Loading screen', weight: 8, durationMs: 6000, color: '#9fb4ff',
    startText: 'LOADING: everything but you has frozen', doneText: 'LOADED',
    mods: { playerSpeedMult: 1.3 }, freezeEnemiesMs: 3500,
  }),
  defineStreetEvent({
    id: 'sugar-rush', name: 'Sugar rush', weight: 10, durationMs: 12000, color: '#ff8bd0',
    startText: 'SUGAR RUSH: fast feet, fat wallet', doneText: 'CRASHED. Worth it',
    mods: { playerSpeedMult: 1.45, credMult: 1.5 },
  }),
  defineStreetEvent({
    id: 'jackpot-hour', name: 'Jackpot hour', weight: 6, durationMs: 20000, color: '#ffc94d',
    startText: 'JACKPOT HOUR: all cred pays double', doneText: 'JACKPOT HOUR OVER',
    mods: { credMult: 2 }, endTokens: { count: 6, luck: 0.3 },
  }),
  defineStreetEvent({
    id: 'patch-notes', name: 'Patch notes', weight: 8, durationMs: 18000, color: '#7fe8ff',
    startText: 'PATCH NOTES: weapons buffed, boots nerfed', doneText: 'PATCH ROLLED BACK',
    mods: { damageMult: 1.35, playerSpeedMult: 0.9 },
  }),
  defineStreetEvent({
    id: 'reskin', name: 'Reskin', weight: 7, durationMs: 8000, color: '#c5a3ff',
    startText: 'RESKIN: everything on screen got softer', doneText: 'RESKIN OVER',
    mods: { xpMult: 1.3 }, enemyHpMult: 0.6,
  }),
  defineStreetEvent({
    id: 'half-time', name: 'Half time', weight: 6, durationMs: 10000, color: '#5ee08a',
    startText: 'HALF TIME: breathe and hit harder', doneText: 'BACK TO IT',
    mods: { damageMult: 1.15 }, healFraction: 0.25,
  }),
];

export const STREET_EVENTS_BY_ID: Record<string, StreetEventDef> = Object.fromEntries(STREET_EVENTS.map((e) => [e.id, e]));

export const STREET_EVENT_FIRST_MS = 70_000;
export const STREET_EVENT_GAP_MS = 90_000;
const STREET_EVENT_JITTER_MS = 60_000;

/** Which event comes `index`-th in a seeded run (pure). */
export function streetEventFor(seed: number, index: number): StreetEventDef {
  const total = STREET_EVENTS.reduce((s, e) => s + e.weight, 0);
  let r = ringHash(seed, index, 0, 301) * total;
  for (const e of STREET_EVENTS) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return STREET_EVENTS[0]!;
}

/** When the `index`-th event starts, counted from the end of the previous one (pure). */
export function streetEventDelayMs(seed: number, index: number): number {
  return (index === 0 ? STREET_EVENT_FIRST_MS : STREET_EVENT_GAP_MS) + Math.floor(ringHash(seed, index, 0, 302) * STREET_EVENT_JITTER_MS);
}
