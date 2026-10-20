/**
 * Sky events: what the spyglass can show in the sky right now.
 *
 * Time is cut into fixed windows. Each window's sky is a pure function of the window
 * number, so every player sees the same sky and it never depends on a saved roll.
 * Looking through the spyglass during a window with something in it starts a timed
 * boost, once per window. Everything tunable lives in `SKY_EVENTS` and the two
 * constants below.
 */
import { createRng } from '@/game/engine/math';
import type { BaseStats } from '@/game/types';

/** The sky is re-rolled this often. */
export const SKY_WINDOW_MS = 2 * 60 * 60 * 1000;

/** How long a boost lasts once started. */
export const SKY_BOOST_MS = 60 * 60 * 1000;

export interface SkyEventDef {
  id: string;
  /** Chance weight among the events of a window. */
  weight: number;
  titleKey: string;
  lineKey: string;
  accent: string;
  /** Fraction added to experience gained (0.05 = +5%). */
  xpBonus: number;
  /** Fraction added to every stat (0.1 = +10%). */
  statBonus: number;
}

export const SKY_EVENTS: SkyEventDef[] = [
  { id: 'clear', weight: 5, titleKey: 'sky.clear.title', lineKey: 'sky.clear.line', accent: '#94a3b8', xpBonus: 0, statBonus: 0 },
  { id: 'glyphs', weight: 3, titleKey: 'sky.glyphs.title', lineKey: 'sky.glyphs.line', accent: '#67e8f9', xpBonus: 0, statBonus: 0.1 },
  { id: 'eclipse', weight: 2, titleKey: 'sky.eclipse.title', lineKey: 'sky.eclipse.line', accent: '#fbbf24', xpBonus: 0.05, statBonus: 0 },
  { id: 'eclipse-glyphs', weight: 1, titleKey: 'sky.eclipse-glyphs.title', lineKey: 'sky.eclipse-glyphs.line', accent: '#f472b6', xpBonus: 0.05, statBonus: 0.15 },
];

export const SKY_EVENTS_BY_ID: Record<string, SkyEventDef> = Object.fromEntries(SKY_EVENTS.map((event) => [event.id, event]));

/** A started boost, saved in the meta. */
export interface SkyBoost {
  eventId: string;
  until: number;
  window: number;
}

export function skyWindow(now: number): number {
  return Math.floor(now / SKY_WINDOW_MS);
}

/** The event in the sky during `window`. */
export function skyForWindow(window: number, events: readonly SkyEventDef[] = SKY_EVENTS): SkyEventDef {
  const total = events.reduce((sum, event) => sum + Math.max(0, event.weight), 0);
  let pick = createRng(window * 7919 + 13)() * total;
  for (const event of events) {
    pick -= Math.max(0, event.weight);
    if (pick <= 0) return event;
  }
  return events[events.length - 1]!;
}

export function skyAt(now: number): SkyEventDef {
  return skyForWindow(skyWindow(now));
}

/** The boost that is running at `now`, or null. */
export function activeSkyBoost(boost: SkyBoost | null | undefined, now: number): SkyEventDef | null {
  if (!boost || now >= boost.until) return null;
  return SKY_EVENTS_BY_ID[boost.eventId] ?? null;
}

/** A new boost for looking at `now`, or null when there is nothing to take. */
export function startSkyBoost(current: SkyBoost | null | undefined, now: number): SkyBoost | null {
  const event = skyAt(now);
  if (event.xpBonus <= 0 && event.statBonus <= 0) return null;
  const window = skyWindow(now);
  if (current && current.window === window) return null;
  return { eventId: event.id, until: now + SKY_BOOST_MS, window };
}

export function skyXpMultiplier(boost: SkyBoost | null | undefined, now: number): number {
  return 1 + (activeSkyBoost(boost, now)?.xpBonus ?? 0);
}

/** Applies a stat bonus to every stat; haste is a cooldown multiplier, so it shrinks. */
export function applySkyStatBonus(stats: BaseStats, bonus: number): void {
  if (bonus <= 0) return;
  const up = 1 + bonus;
  stats.maxHp *= up;
  stats.speed *= up;
  stats.power *= up;
  stats.area *= up;
  stats.magnet *= up;
  stats.armor *= up;
  stats.crit *= up;
  stats.lifesteal *= up;
  stats.haste /= up;
}

export function normalizeSkyBoost(value: unknown): SkyBoost | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.eventId !== 'string' || !SKY_EVENTS_BY_ID[v.eventId]) return null;
  if (typeof v.until !== 'number' || !Number.isFinite(v.until)) return null;
  if (typeof v.window !== 'number' || !Number.isFinite(v.window)) return null;
  return { eventId: v.eventId, until: v.until, window: Math.trunc(v.window) };
}
