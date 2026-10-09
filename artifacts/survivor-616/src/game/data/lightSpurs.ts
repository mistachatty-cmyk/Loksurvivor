/**
 * Light Spurs: streaks of light that show over places where many Digi enemies move
 * abnormally. Looking at one through the spyglass reveals that location and unlocks it.
 *
 * Like the sky (`skyEvents.ts`), a spur is a pure function of a fixed time window, so every
 * player sees the same one and nothing is saved until the player follows it. Only places
 * that are still locked can show a spur. Add a place by adding a row to `SPUR_LEADS`.
 */
import { createRng } from '@/game/engine/math';

/** A spur can show up this often. */
export const SPUR_WINDOW_MS = 4 * 60 * 60 * 1000;

/** Chance a window has a spur. */
export const SPUR_CHANCE = 0.4;

export interface SpurLeadDef {
  /** The `AreaDef` id this spur leads to. */
  areaId: string;
}

export const SPUR_LEADS: SpurLeadDef[] = [
  { areaId: 'null-sector' },
  { areaId: 'digital-disco' },
  { areaId: 'glassroot-annex' },
];

export function spurWindow(now: number): number {
  return Math.floor(now / SPUR_WINDOW_MS);
}

/**
 * The spur in the sky at `now`, or null. `isOpen` says whether a place is already open to the
 * player; open places never show a spur.
 */
export function spurAt(now: number, isOpen: (areaId: string) => boolean, leads: readonly SpurLeadDef[] = SPUR_LEADS): SpurLeadDef | null {
  const rng = createRng(spurWindow(now) * 15485863 + 11);
  const appears = rng() < SPUR_CHANCE;
  const pick = rng();
  if (!appears) return null;
  const eligible = leads.filter((lead) => !isOpen(lead.areaId));
  if (eligible.length === 0) return null;
  return eligible[Math.floor(pick * eligible.length) % eligible.length]!;
}

/** Keeps only saved ids that are real leads. */
export function normalizeSpurAreaIds(value: unknown, leads: readonly SpurLeadDef[] = SPUR_LEADS): string[] {
  if (!Array.isArray(value)) return [];
  const known = new Set(leads.map((lead) => lead.areaId));
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && known.has(id)))];
}
