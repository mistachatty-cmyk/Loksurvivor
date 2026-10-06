/**
 * Hideout companions: temperaments and small events, all as data.
 *
 * - A **temperament** is how a pet carries itself in the hideout (how far it
 *   wanders, how quick it is, how often it naps). It is derived from the pet's
 *   id, so a pet always acts the same way. Add one by adding a row.
 * - An **event** is a short scene: a move, an emote and one line of text, gated by
 *   simple conditions (bond rank, time of day, weather, music, temperament).
 *   Add one by adding a row; `hideoutEvents.test.ts` checks every row.
 *
 * Nothing here touches the run simulation. The pure movement rules are in
 * `engine/hideoutPets.ts`; the canvas drawing is in `ui/HideoutPreview.tsx`.
 */

import type { HideoutWeather } from '@/game/types';
import { BOND_RANK_BY_ID, type BondRankId } from '@/game/engine/petGrowth';

export type HideoutTemperamentId = 'bouncy' | 'chill' | 'shy' | 'bold' | 'sleepy';

export interface HideoutTemperament {
  id: HideoutTemperamentId;
  label: string;
  /** Follow speed, 1 is normal. */
  speed: number;
  /** How far behind the operator it likes to trail, in operator-widths. */
  distance: number;
  /** Relative odds of each thing it does when the operator rests. */
  idle: { sit: number; sniff: number; nap: number; wander: number; watch: number };
  /** How much it bounces to music, 0 to 1. */
  groove: number;
}

export const HIDEOUT_TEMPERAMENTS: HideoutTemperament[] = [
  { id: 'bouncy', label: 'Bouncy', speed: 1.25, distance: 0.45, idle: { sit: 1, sniff: 2, nap: 0, wander: 4, watch: 1 }, groove: 1 },
  { id: 'chill', label: 'Chill', speed: 0.9, distance: 0.65, idle: { sit: 3, sniff: 1, nap: 2, wander: 1, watch: 3 }, groove: 0.6 },
  { id: 'shy', label: 'Shy', speed: 0.85, distance: 0.9, idle: { sit: 3, sniff: 3, nap: 1, wander: 0, watch: 2 }, groove: 0.35 },
  { id: 'bold', label: 'Bold', speed: 1.1, distance: 0.35, idle: { sit: 1, sniff: 2, nap: 0, wander: 3, watch: 2 }, groove: 0.85 },
  { id: 'sleepy', label: 'Sleepy', speed: 0.75, distance: 0.7, idle: { sit: 2, sniff: 0, nap: 6, wander: 0, watch: 1 }, groove: 0.45 },
];

export const HIDEOUT_TEMPERAMENTS_BY_ID: Record<HideoutTemperamentId, HideoutTemperament> = Object.fromEntries(
  HIDEOUT_TEMPERAMENTS.map((t) => [t.id, t]),
) as Record<HideoutTemperamentId, HideoutTemperament>;

/** Deterministic: a pet always has the same temperament. */
export function temperamentFor(petId: string): HideoutTemperament {
  let hash = 2166136261;
  for (let i = 0; i < petId.length; i += 1) {
    hash ^= petId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return HIDEOUT_TEMPERAMENTS[(hash >>> 0) % HIDEOUT_TEMPERAMENTS.length]!;
}

export type HideoutTimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';
export type HideoutMove = 'hop' | 'spin' | 'sit' | 'nap' | 'dash' | 'sway' | 'splash' | 'sniff' | 'bow';
export type HideoutEmote = 'heart' | 'note' | 'zzz' | 'spark' | 'bang' | 'drop' | 'star';

export const HIDEOUT_MOVES: HideoutMove[] = ['hop', 'spin', 'sit', 'nap', 'dash', 'sway', 'splash', 'sniff', 'bow'];
export const HIDEOUT_EMOTES: HideoutEmote[] = ['heart', 'note', 'zzz', 'spark', 'bang', 'drop', 'star'];

export function timeOfDayFor(hour: number): HideoutTimeOfDay {
  if (hour >= 5 && hour < 9) return 'dawn';
  if (hour >= 9 && hour < 17) return 'day';
  if (hour >= 17 && hour < 21) return 'dusk';
  return 'night';
}

export interface HideoutEventContext {
  /** Local hour, 0 to 23. */
  hour: number;
  weather: HideoutWeather;
  musicPlaying: boolean;
  bondRank: BondRankId;
  temperament: HideoutTemperamentId;
}

export interface HideoutEventDef {
  id: string;
  title: string;
  /** `{pet}` is the pet's call name, `{you}` is what it calls you (or "you"). */
  line: string;
  move: HideoutMove;
  emote: HideoutEmote;
  durationMs: number;
  when: {
    minBond?: BondRankId;
    timeOfDay?: HideoutTimeOfDay[];
    weather?: HideoutWeather[];
    /** true needs music playing, false needs silence. */
    music?: boolean;
    temperament?: HideoutTemperamentId[];
    /** Local hours (0 to 23) it can happen in, for easter eggs. */
    hours?: number[];
  };
  /** Relative odds among the events that fit right now. */
  weight: number;
  /** Do not repeat for this pet within this many ms. */
  cooldownMs: number;
  /** Plays once per pet, ever. */
  once?: boolean;
  /** Reward: a little XP (unscaled, so 10 is small) and bond (default yes, bond is capped daily). */
  reward?: { exp?: number; bond?: boolean };
}

const MIN = 60_000;
const HOUR = 60 * MIN;

export const HIDEOUT_EVENTS: HideoutEventDef[] = [
  { id: 'morning-stretch', title: 'Morning stretch', line: '{pet} stretches out long and yawns, then looks at {you} like it is time.', move: 'bow', emote: 'spark', durationMs: 3200, when: { timeOfDay: ['dawn'] }, weight: 4, cooldownMs: 18 * HOUR, reward: { exp: 8 } },
  { id: 'rain-splash', title: 'Puddle day', line: '{pet} finds the one puddle and gives it a proper stomping.', move: 'splash', emote: 'drop', durationMs: 3600, when: { weather: ['rain'] }, weight: 5, cooldownMs: 20 * MIN },
  { id: 'snow-spin', title: 'First flakes', line: '{pet} spins in place, trying to catch every flake.', move: 'spin', emote: 'star', durationMs: 3000, when: { weather: ['snow'] }, weight: 5, cooldownMs: 20 * MIN },
  { id: 'fog-sniff', title: 'Something in the fog', line: '{pet} sniffs at the fog like it is hiding a snack.', move: 'sniff', emote: 'bang', durationMs: 3400, when: { weather: ['fog'] }, weight: 4, cooldownMs: 25 * MIN },
  { id: 'heat-nap', title: 'Too warm to move', line: '{pet} flops down in the warm air. Nobody is moving fast today.', move: 'nap', emote: 'zzz', durationMs: 5200, when: { weather: ['heat'] }, weight: 4, cooldownMs: 25 * MIN },
  { id: 'dance-break', title: 'Dance break', line: '{pet} drops everything and dances to the beat.', move: 'spin', emote: 'note', durationMs: 4200, when: { music: true }, weight: 7, cooldownMs: 2 * MIN, reward: { exp: 6 } },
  { id: 'head-bob', title: 'Head bob', line: '{pet} keeps time with a little hop, right on the beat.', move: 'hop', emote: 'note', durationMs: 3600, when: { music: true }, weight: 6, cooldownMs: 90_000 },
  { id: 'quiet-nap', title: 'Quiet hour', line: 'It is quiet, so {pet} curls up and naps beside {you}.', move: 'nap', emote: 'zzz', durationMs: 6000, when: { music: false, timeOfDay: ['dusk', 'night'] }, weight: 5, cooldownMs: 30 * MIN },
  { id: 'zoomies', title: 'Zoomies', line: '{pet} gets the zoomies and runs a lap around the strip.', move: 'dash', emote: 'bang', durationMs: 2800, when: { temperament: ['bouncy', 'bold'] }, weight: 4, cooldownMs: 10 * MIN },
  { id: 'shy-peek', title: 'Shy peek', line: '{pet} hides behind {you} and peeks out at the street.', move: 'sniff', emote: 'bang', durationMs: 3200, when: { temperament: ['shy'] }, weight: 4, cooldownMs: 15 * MIN },
  { id: 'tail-chase', title: 'Tail chase', line: '{pet} spots something at the back and spins to catch it.', move: 'spin', emote: 'spark', durationMs: 3000, when: { timeOfDay: ['day', 'dusk'] }, weight: 3, cooldownMs: 12 * MIN },
  { id: 'good-friend', title: 'Good friend', line: '{pet} bumps against {you} and does a happy hop.', move: 'hop', emote: 'heart', durationMs: 3200, when: { minBond: 'friend' }, weight: 4, cooldownMs: 40 * MIN, reward: { exp: 10 } },
  { id: 'partner-bow', title: 'Partner\'s bow', line: '{pet} bows to {you} like they have been planning it all day.', move: 'bow', emote: 'star', durationMs: 3400, when: { minBond: 'partner' }, weight: 3, cooldownMs: 2 * HOUR, reward: { exp: 15 } },
  { id: 'knowing-look', title: 'Knowing look', line: '{pet} looks at {you} for a long moment, like it knows something you do not.', move: 'sway', emote: 'heart', durationMs: 4200, when: { minBond: 'soulbound' }, weight: 3, cooldownMs: 6 * HOUR, once: true, reward: { exp: 40 } },
  { id: 'three-am-visitor', title: 'The 3 a.m. visitor', line: 'Something small and odd wanders by at 3 a.m. {pet} sniffs it, then lets it go.', move: 'sniff', emote: 'bang', durationMs: 4400, when: { hours: [3] }, weight: 9, cooldownMs: 20 * HOUR, reward: { exp: 20 } },
];

export const HIDEOUT_EVENTS_BY_ID: Record<string, HideoutEventDef> = Object.fromEntries(HIDEOUT_EVENTS.map((e) => [e.id, e]));

/**
 * The part of an event the picker needs, so other tables (pet care verbs, choice events)
 * reuse the same conditions, cooldowns and weighted pick instead of copying them.
 */
export interface EventGate {
  id: string;
  weight: number;
  cooldownMs: number;
  once?: boolean;
  when: HideoutEventDef['when'];
}

/** True when the event's conditions fit right now (cooldowns are checked separately). */
export function eventFits(def: Pick<EventGate, 'when'>, ctx: HideoutEventContext): boolean {
  const w = def.when;
  if (w.minBond && BOND_RANK_BY_ID[ctx.bondRank].order < BOND_RANK_BY_ID[w.minBond].order) return false;
  if (w.timeOfDay && !w.timeOfDay.includes(timeOfDayFor(ctx.hour))) return false;
  if (w.weather && !w.weather.includes(ctx.weather)) return false;
  if (w.music !== undefined && w.music !== ctx.musicPlaying) return false;
  if (w.temperament && !w.temperament.includes(ctx.temperament)) return false;
  if (w.hours && !w.hours.includes(ctx.hour)) return false;
  return true;
}

/** `history` maps event id to the last time it played for this pet. */
export function eventReady(def: Pick<EventGate, 'id' | 'once' | 'cooldownMs'>, history: Record<string, number> | undefined, now: number): boolean {
  const last = history?.[def.id];
  if (last === undefined) return true;
  if (def.once) return false;
  return now - last >= def.cooldownMs;
}

/** Weighted pick among the events that fit and are off cooldown. Null when nothing fits. */
export function pickHideoutEvent<T extends EventGate = HideoutEventDef>(
  ctx: HideoutEventContext,
  history: Record<string, number> | undefined,
  now: number,
  rng: () => number,
  defs: readonly T[] = HIDEOUT_EVENTS as unknown as readonly T[],
): T | null {
  const options = defs.filter((def) => eventFits(def, ctx) && eventReady(def, history, now));
  const total = options.reduce((sum, def) => sum + def.weight, 0);
  if (options.length === 0 || total <= 0) return null;
  let roll = rng() * total;
  for (const def of options) {
    roll -= def.weight;
    if (roll <= 0) return def;
  }
  return options[options.length - 1]!;
}

export function formatEventLine(def: HideoutEventDef, names: { pet: string; you?: string }): string {
  return def.line.replace(/\{pet\}/g, names.pet).replace(/\{you\}/g, names.you?.trim() || 'you');
}
