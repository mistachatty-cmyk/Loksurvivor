/**
 * Event buffs: what some hideout events leave behind. Each one is a boost paired with a
 * cost, so a lucky moment helps in one way and hurts in another for a while. Only one runs
 * at a time; a new one replaces the old. All data: add a row, its three strings in
 * `en.json`, and point an event outcome at it with `buffId`.
 */
import type { BaseStats } from '@/game/types';

/** How long a buff lasts. */
export const EVENT_BUFF_MS = 60 * 60 * 1000;

export interface EventBuffEffect {
  stat: keyof BaseStats;
  /** Multiplier on the stat. Below 1 lowers it; for `haste` a lower number means faster. */
  mult: number;
}

export interface EventBuffDef {
  id: string;
  boost: EventBuffEffect;
  cost: EventBuffEffect;
}

export const EVENT_BUFFS: EventBuffDef[] = [
  { id: 'warm-heart', boost: { stat: 'speed', mult: 1.08 }, cost: { stat: 'power', mult: 0.95 } },
  { id: 'borrowed-luck', boost: { stat: 'magnet', mult: 1.2 }, cost: { stat: 'armor', mult: 0.9 } },
  { id: 'steady-breath', boost: { stat: 'maxHp', mult: 1.1 }, cost: { stat: 'speed', mult: 0.94 } },
  { id: 'sharp-eyes', boost: { stat: 'power', mult: 1.08 }, cost: { stat: 'maxHp', mult: 0.92 } },
  { id: 'quick-hands', boost: { stat: 'haste', mult: 0.92 }, cost: { stat: 'area', mult: 0.95 } },
  { id: 'thick-skin', boost: { stat: 'armor', mult: 1.12 }, cost: { stat: 'speed', mult: 0.94 } },
  { id: 'wide-swing', boost: { stat: 'area', mult: 1.08 }, cost: { stat: 'haste', mult: 1.06 } },
];

export const EVENT_BUFFS_BY_ID: Record<string, EventBuffDef> = Object.fromEntries(EVENT_BUFFS.map((buff) => [buff.id, buff]));

/** A started buff, saved in the meta. */
export interface EventBuff {
  buffId: string;
  until: number;
}

export function startEventBuff(buffId: string, now: number): EventBuff | null {
  return EVENT_BUFFS_BY_ID[buffId] ? { buffId, until: now + EVENT_BUFF_MS } : null;
}

/** The buff that is running at `now`, or null. */
export function activeEventBuff(buff: EventBuff | null | undefined, now: number): EventBuffDef | null {
  if (!buff || now >= buff.until) return null;
  return EVENT_BUFFS_BY_ID[buff.buffId] ?? null;
}

/** Applies the running buff's boost and cost to `stats`. */
export function applyEventBuff(stats: BaseStats, buff: EventBuffDef | null): void {
  if (!buff) return;
  stats[buff.boost.stat] *= buff.boost.mult;
  stats[buff.cost.stat] *= buff.cost.mult;
}

/** The change as whole percent, signed for readers: haste reads as the speed-up it is. */
export function describePercent(effect: EventBuffEffect): number {
  const raw = effect.stat === 'haste' ? 1 / effect.mult : effect.mult;
  return Math.round((raw - 1) * 100);
}

export function normalizeEventBuff(value: unknown): EventBuff | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.buffId !== 'string' || !EVENT_BUFFS_BY_ID[v.buffId]) return null;
  if (typeof v.until !== 'number' || !Number.isFinite(v.until)) return null;
  return { buffId: v.buffId, until: v.until };
}
