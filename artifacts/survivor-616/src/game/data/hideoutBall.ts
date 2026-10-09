/**
 * The hideout Ball: how interested each pet is, how the throw feels under a UI theme,
 * and the tuning for the throw and the race. All data; the rules are in
 * `engine/hideoutBall.ts`.
 *
 * Most pets love the ball. About one in five is ball-shy: it sits the race out until
 * the bond is strong or you have played with it today.
 */
import type { HideoutTemperamentId } from '@/game/data/hideoutEvents';

/** A pet joins the race at or above this interest. */
export const BALL_JOIN_THRESHOLD = 0.5;

/** Base interest by temperament, 0 to 1. */
export const BALL_INTEREST_BY_TEMPERAMENT: Record<HideoutTemperamentId, number> = {
  bouncy: 0.95,
  bold: 0.85,
  chill: 0.7,
  sleepy: 0.55,
  shy: 0.6,
};

/** A ball-shy pet starts here, whatever its temperament. */
export const BALL_SHY_INTEREST = 0.15;

/** Share of pets that are ball-shy (decided by a hash of the pet id, so it never changes). */
export const BALL_SHY_SHARE = 0.2;

/** Interest a ball-shy pet gains per bond rank (stranger = 0). */
export const BALL_SHY_BOND_BONUS = 0.12;

/** Interest a ball-shy pet gains for being played with today. */
export const BALL_SHY_PLAYED_BONUS = 0.25;

/** How a throw feels. A UI theme picks one by its id, so the same theme always throws the same way. */
export interface ThrowFeel {
  id: string;
  /** Distance multiplier. */
  power: number;
  /** Height multiplier. */
  loft: number;
  /** How lively the bounce is, 0 to 1. */
  bounce: number;
}

export const THROW_FEELS: ThrowFeel[] = [
  { id: 'steady', power: 1, loft: 1, bounce: 0.45 },
  { id: 'floaty', power: 0.85, loft: 1.5, bounce: 0.55 },
  { id: 'heavy', power: 1.15, loft: 0.7, bounce: 0.25 },
  { id: 'springy', power: 0.95, loft: 1.1, bounce: 0.7 },
  { id: 'rocket', power: 1.4, loft: 0.8, bounce: 0.4 },
];

/** Pixels per millisecond a pet runs at speed 1.0 while racing (temperament speed scales it). */
export const RACE_BASE_SPEED = 0.16;

/** Extra race speed per bond rank (0.04 = 4% each). */
export const RACE_BOND_SPEED_BONUS = 0.04;

/** Winner celebration: spit the ball out, then spin, then jump on the head, then jump off. */
export interface WinnerStep {
  id: 'spit' | 'spin' | 'head-jump' | 'jump-off';
  ms: number;
}

export const WINNER_STEPS: WinnerStep[] = [
  { id: 'spit', ms: 450 },
  { id: 'spin', ms: 750 },
  { id: 'head-jump', ms: 650 },
  { id: 'jump-off', ms: 500 },
];
