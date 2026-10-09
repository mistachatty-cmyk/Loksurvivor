/**
 * The hideout Ball: pure rules. No canvas, no React, no clock (callers pass `dt` and `now`
 * in strip milliseconds) and no hidden randomness, so every rule is testable.
 *
 * Life of a ball: it lies on the ground; a tap sends the operator to fetch it; the operator
 * carries it; a throw sends it flying along the strip; once it settles the interested pets
 * race for it; the winner spits it out, spins, jumps on the operator's head and jumps off.
 */
import {
  BALL_INTEREST_BY_TEMPERAMENT,
  BALL_JOIN_THRESHOLD,
  BALL_SHY_BOND_BONUS,
  BALL_SHY_INTEREST,
  BALL_SHY_PLAYED_BONUS,
  BALL_SHY_SHARE,
  RACE_BASE_SPEED,
  RACE_BOND_SPEED_BONUS,
  THROW_FEELS,
  WINNER_STEPS,
  type ThrowFeel,
  type WinnerStep,
} from '@/game/data/hideoutBall';
import { temperamentFor } from '@/game/data/hideoutEvents';

export type BallPhase = 'ground' | 'fetch' | 'carried' | 'flying' | 'racing' | 'celebrating';

export interface BallState {
  phase: BallPhase;
  x: number;
  /** Pixels above the ground. */
  z: number;
  vx: number;
  vz: number;
  /** Pets running for it, in the order they were picked. */
  racers: string[];
  winnerId: string | null;
  /** Strip time the celebration began. */
  celebrationStart: number;
}

const GRAVITY = 0.0016;
const FRICTION_PER_MS = 0.0035;
const SETTLE_SPEED = 0.01;
const CATCH_DISTANCE = 6;
const PICKUP_DISTANCE = 8;
/** Throw speed in pixels per millisecond at full power. */
const THROW_SPEED = 0.55;
const THROW_LOFT = 0.34;
/** Height of the operator's head, where a carried ball rides. */
export const CARRY_HEIGHT = 26;

export const createBall = (x: number): BallState => ({
  phase: 'ground', x, z: 0, vx: 0, vz: 0, racers: [], winnerId: null, celebrationStart: 0,
});

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Whether this pet is one of the ball-shy ones. Fixed per pet. */
export function isBallShy(petId: string): boolean {
  return (hash(`ball:${petId}`) % 1000) / 1000 < BALL_SHY_SHARE;
}

export interface InterestInput {
  petId: string;
  /** Bond rank order, 0 (stranger) and up. */
  bondOrder: number;
  /** Played with it today. */
  playedToday: boolean;
}

/** 0 to 1: how much this pet wants the ball right now. */
export function ballInterest(input: InterestInput): number {
  if (!isBallShy(input.petId)) return BALL_INTEREST_BY_TEMPERAMENT[temperamentFor(input.petId).id];
  const lifted = BALL_SHY_INTEREST + input.bondOrder * BALL_SHY_BOND_BONUS + (input.playedToday ? BALL_SHY_PLAYED_BONUS : 0);
  return Math.min(1, lifted);
}

/** The throw feel a UI theme gives, the same every time for the same theme. */
export function throwFeelFor(themeId: string): ThrowFeel {
  return THROW_FEELS[hash(`theme:${themeId}`) % THROW_FEELS.length]!;
}

/** The operator starts walking to a ball lying on the ground. */
export function startFetch(ball: BallState): boolean {
  if (ball.phase !== 'ground') return false;
  ball.phase = 'fetch';
  return true;
}

/** Call each step while fetching: the operator picks the ball up once close enough. */
export function stepFetch(ball: BallState, operatorX: number): boolean {
  if (ball.phase !== 'fetch' || Math.abs(ball.x - operatorX) > PICKUP_DISTANCE) return false;
  ball.phase = 'carried';
  return true;
}

/** Keeps a carried ball on the operator's head height. */
export function carryBall(ball: BallState, operatorX: number): void {
  if (ball.phase !== 'carried') return;
  ball.x = operatorX;
  ball.z = CARRY_HEIGHT;
}

/**
 * Throws a carried ball. `dir` is -1 or 1, `power` is 0 to 1 (how far the player dragged or tapped),
 * and `feel` comes from the UI theme.
 */
export function throwBall(ball: BallState, dir: 1 | -1, power: number, feel: ThrowFeel): boolean {
  if (ball.phase !== 'carried') return false;
  const p = Math.max(0.15, Math.min(1, power));
  ball.phase = 'flying';
  ball.vx = dir * THROW_SPEED * p * feel.power;
  ball.vz = THROW_LOFT * feel.loft * (0.6 + 0.4 * p);
  return true;
}

export interface Racer {
  id: string;
  x: number;
  /** Temperament speed (1 is normal). */
  speed: number;
  bondOrder: number;
  interest: number;
}

/** Pets that want the ball, most interested first. */
export function pickRacers(pets: readonly Racer[]): Racer[] {
  return pets.filter((pet) => pet.interest >= BALL_JOIN_THRESHOLD).sort((a, b) => b.interest - a.interest || a.id.localeCompare(b.id));
}

/** Pixels per millisecond for a racer. */
export function raceSpeed(racer: Pick<Racer, 'speed' | 'bondOrder'>): number {
  return RACE_BASE_SPEED * racer.speed * (1 + racer.bondOrder * RACE_BOND_SPEED_BONUS);
}

/**
 * Moves a flying ball. When it settles the race starts with `racers`; with nobody
 * interested the ball simply rests on the ground again. Returns the new phase.
 */
export function stepFlight(ball: BallState, dt: number, feel: ThrowFeel, range: { min: number; max: number }, racers: readonly Racer[]): BallPhase {
  if (ball.phase !== 'flying') return ball.phase;
  ball.x += ball.vx * dt;
  if (ball.x < range.min) { ball.x = range.min; ball.vx = Math.abs(ball.vx) * 0.5; }
  if (ball.x > range.max) { ball.x = range.max; ball.vx = -Math.abs(ball.vx) * 0.5; }
  ball.vz -= GRAVITY * dt;
  ball.z += ball.vz * dt;
  if (ball.z <= 0) {
    ball.z = 0;
    ball.vz = Math.abs(ball.vz) * feel.bounce;
    if (ball.vz < 0.05) ball.vz = 0;
  }
  if (ball.z === 0 && ball.vz === 0) {
    const slowed = Math.max(0, Math.abs(ball.vx) - FRICTION_PER_MS * dt * Math.max(1, Math.abs(ball.vx) * 100));
    ball.vx = Math.sign(ball.vx) * slowed;
    if (slowed < SETTLE_SPEED) {
      ball.vx = 0;
      const field = pickRacers(racers);
      ball.racers = field.map((racer) => racer.id);
      ball.phase = field.length > 0 ? 'racing' : 'ground';
    }
  }
  return ball.phase;
}

/**
 * Steps a pet one frame toward the ball, returning its new x. Call for each racer while the phase is
 * `racing`; the first within catching distance wins and the celebration begins at `now`.
 */
export function stepRacer(ball: BallState, racer: Racer, dt: number, now: number): number {
  if (ball.phase !== 'racing') return racer.x;
  const gap = ball.x - racer.x;
  if (Math.abs(gap) <= CATCH_DISTANCE) {
    ball.phase = 'celebrating';
    ball.winnerId = racer.id;
    ball.celebrationStart = now;
    return racer.x;
  }
  const step = Math.min(Math.abs(gap), raceSpeed(racer) * dt);
  return racer.x + Math.sign(gap) * step;
}

export interface CelebrationStage {
  step: WinnerStep['id'];
  /** 0 to 1 through this step. */
  progress: number;
  done: boolean;
}

/** Which part of the winner's routine is playing at `now`. */
export function celebrationStage(ball: BallState, now: number, steps: readonly WinnerStep[] = WINNER_STEPS): CelebrationStage {
  let elapsed = Math.max(0, now - ball.celebrationStart);
  for (const step of steps) {
    if (elapsed < step.ms) return { step: step.id, progress: elapsed / step.ms, done: false };
    elapsed -= step.ms;
  }
  const last = steps[steps.length - 1]!;
  return { step: last.id, progress: 1, done: true };
}

/** After the routine the ball rests on the ground again, ready to be fetched. */
export function finishCelebration(ball: BallState, operatorX: number): void {
  ball.phase = 'ground';
  ball.x = operatorX;
  ball.z = 0;
  ball.vx = 0;
  ball.vz = 0;
  ball.racers = [];
  ball.winnerId = null;
}
