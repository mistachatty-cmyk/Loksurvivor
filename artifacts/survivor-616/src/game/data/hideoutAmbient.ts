/**
 * Hideout ambient life: visitors that cross the strip, a Digi mite you can squash, and
 * small things that turn up on the ground. All data; the rules are in
 * `engine/hideoutAmbient.ts`.
 *
 * Each visitor says how every pet temperament reacts (an emote and a move), so a llama
 * can charm one pet and scare another. Pickups pay through the shared hideout limits.
 */
import type { HideoutEmote, HideoutMove, HideoutTemperamentId } from '@/game/data/hideoutEvents';
import type { SmallReward } from '@/game/engine/hideoutRewards';

export interface AmbientReaction {
  emote: HideoutEmote;
  move: HideoutMove;
}

export type AmbientMotion =
  /** Crosses the whole strip in one direction and leaves. */
  | 'cross'
  /** Creeps in, wanders a while, then leaves; can be squashed. */
  | 'creep';

export interface AmbientVisitorDef {
  id: string;
  motion: AmbientMotion;
  /** Pixels per millisecond. */
  speed: number;
  /** Height as a share of the strip height. */
  size: number;
  /** Chance weight among visitors. */
  weight: number;
  accent: string;
  body: string;
  /** Locale key for the line shown when it arrives. */
  lineKey: string;
  /** How a pet reacts when this passes close, by temperament. */
  reactions: Record<HideoutTemperamentId, AmbientReaction>;
  /** The operator can tap it to squash it. */
  squashable?: boolean;
}

const happy: AmbientReaction = { emote: 'adore', move: 'hop' };
const startled: AmbientReaction = { emote: 'scared', move: 'dash' };
const amused: AmbientReaction = { emote: 'laugh', move: 'sway' };
const curious: AmbientReaction = { emote: 'bang', move: 'sniff' };

export const AMBIENT_VISITORS: AmbientVisitorDef[] = [
  {
    id: 'llama', motion: 'cross', speed: 0.2, size: 0.62, weight: 4, accent: '#f5f5f4', body: '#d6c4a0',
    lineKey: 'hideout.ambient.llama',
    reactions: { bouncy: happy, bold: amused, chill: happy, sleepy: curious, shy: startled },
  },
  {
    id: 'running-man', motion: 'cross', speed: 0.34, size: 0.7, weight: 3, accent: '#fb923c', body: '#374151',
    lineKey: 'hideout.ambient.running-man',
    reactions: { bouncy: amused, bold: curious, chill: curious, sleepy: curious, shy: startled },
  },
  {
    id: 'courier', motion: 'cross', speed: 0.14, size: 0.7, weight: 2, accent: '#38bdf8', body: '#1e3a5f',
    lineKey: 'hideout.ambient.courier',
    reactions: { bouncy: happy, bold: curious, chill: happy, sleepy: curious, shy: curious },
  },
  {
    id: 'digi-mite', motion: 'creep', speed: 0.035, size: 0.16, weight: 4, accent: '#4ade80', body: '#14532d',
    lineKey: 'hideout.ambient.digi-mite', squashable: true,
    reactions: { bouncy: curious, bold: curious, chill: curious, sleepy: curious, shy: startled },
  },
];

export const AMBIENT_VISITORS_BY_ID: Record<string, AmbientVisitorDef> = Object.fromEntries(AMBIENT_VISITORS.map((v) => [v.id, v]));

export interface AmbientPickupDef {
  id: string;
  weight: number;
  reward: SmallReward;
  color: string;
}

/** Things that turn up on the ground; walk over one (or tap it) to pick it up. */
export const AMBIENT_PICKUPS: AmbientPickupDef[] = [
  { id: 'coin', weight: 6, reward: { cred: 2 }, color: '#fde047' },
  { id: 'scrap', weight: 4, reward: { cred: 1 }, color: '#cbd5e1' },
  { id: 'snack', weight: 1, reward: { lokPetTreats: 1 }, color: '#f9a8d4' },
];

export const AMBIENT_PICKUPS_BY_ID: Record<string, AmbientPickupDef> = Object.fromEntries(AMBIENT_PICKUPS.map((p) => [p.id, p]));

/** Timing, in strip milliseconds. */
export const AMBIENT_TIMING = {
  firstVisitorMs: 15_000,
  visitorGapMs: [35_000, 80_000] as const,
  firstPickupMs: 10_000,
  pickupGapMs: [22_000, 50_000] as const,
  pickupLifeMs: 30_000,
  maxPickups: 2,
  squashMs: 700,
  /** How close a visitor must pass to a pet to set off a reaction, in operator-widths. */
  reactRadiusUnits: 0.9,
  /** How close the operator must be to pick something up, in operator-widths. */
  pickupReachUnits: 0.35,
};
