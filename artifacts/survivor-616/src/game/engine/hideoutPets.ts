/**
 * Pure movement and pose rules for the pets that walk the hideout strip beside
 * your operator. No canvas, no React, no clock: callers pass `dt` and `now` (ms of
 * strip time), and an injected `rng`, so every rule is testable.
 *
 * Shape of a pet's day: it follows the operator, sits or sniffs or naps when the
 * operator stops, bounces to the music when there is any, comes when you tap the
 * ground, and plays a short scripted move when an event fires
 * (`data/hideoutEvents.ts`).
 */

import {
  HIDEOUT_TEMPERAMENTS_BY_ID,
  temperamentFor,
  type HideoutEmote,
  type HideoutMove,
  type HideoutTemperament,
} from '@/game/data/hideoutEvents';

/* ------------------------------ The operator ------------------------------- */

export interface OperatorWalk {
  x: number;
  dir: 1 | -1;
  mode: 'walk' | 'rest';
  /** Strip time at which the current mode ends. */
  until: number;
}

/** Same pace the strip always used. */
export const OPERATOR_SPEED_PX_PER_MS = 0.045;

export function createOperatorWalk(range: { min: number; max: number }, now: number): OperatorWalk {
  return { x: (range.min + range.max) / 2, dir: 1, mode: 'walk', until: now + 5000 };
}

/** The operator walks a leg, stops for a breather, then turns around. Pets use the pauses. */
export function stepOperatorWalk(op: OperatorWalk, dt: number, now: number, range: { min: number; max: number }, rng: () => number): void {
  if (op.mode === 'walk') {
    op.x += op.dir * OPERATOR_SPEED_PX_PER_MS * dt;
    let hitEdge = false;
    if (op.x >= range.max) { op.x = range.max; hitEdge = true; }
    if (op.x <= range.min) { op.x = range.min; hitEdge = true; }
    if (hitEdge || now >= op.until) {
      op.mode = 'rest';
      op.until = now + 3000 + rng() * 4000;
      if (hitEdge) op.dir = op.x >= range.max ? -1 : 1;
    }
  } else if (now >= op.until) {
    op.mode = 'walk';
    op.until = now + 4500 + rng() * 5000;
    // Sometimes turn around after a rest instead of carrying on.
    if (rng() < 0.3) op.dir = (op.dir * -1) as 1 | -1;
  }
}

/* -------------------------------- The pets --------------------------------- */

export type PetMode = 'follow' | 'idle' | 'call';
export type IdleKind = 'sit' | 'sniff' | 'nap' | 'wander' | 'watch';

export interface HideoutPetState {
  id: string;
  x: number;
  facing: 1 | -1;
  mode: PetMode;
  idleKind: IdleKind;
  /** Strip time at which an idle or a call ends. */
  modeUntil: number;
  /** Where it is heading while idle-wandering or being called. */
  targetX: number;
  walking: boolean;
  /** Strip time the operator last stopped, or null while the operator walks. */
  operatorRestingSince: number | null;
  move: { kind: HideoutMove; start: number; until: number } | null;
  emote: { kind: HideoutEmote; start: number; until: number } | null;
  /** Strip time it was last tapped (for the double-tap trick). */
  lastTapAt: number;
  /** Rapid taps in the current streak, and every tap this visit. */
  spinStreak: number;
  spinTotal: number;
  /** Strip time the dizzy or sick spell ends (0 when neither). */
  dizzyUntil: number;
  sickUntil: number;
  /** 0..1 spin speed that builds with every quick tap, then bleeds off. */
  momentum: number;
  temperamentId: HideoutTemperament['id'];
}

export function createHideoutPetState(id: string, x: number): HideoutPetState {
  return {
    id, x, facing: 1, mode: 'follow', idleKind: 'sit', modeUntil: 0, targetX: x, walking: false,
    operatorRestingSince: null, move: null, emote: null, lastTapAt: -10_000, spinStreak: 0, spinTotal: 0, dizzyUntil: 0, sickUntil: 0, momentum: 0, temperamentId: temperamentFor(id).id,
  };
}

export interface PetStepInput {
  dt: number;
  now: number;
  operator: OperatorWalk;
  /** Which trailing spot this pet takes behind the operator, 0 for the first. */
  slot: number;
  range: { min: number; max: number };
  /** Pixels in one operator-width, used to scale trailing distance. */
  unit: number;
  rng: () => number;
}

const MAX_SPEED_PX_PER_MS = 0.1;
const REST_BEFORE_IDLE_MS = 1400;

function weightedIdle(t: HideoutTemperament, rng: () => number): IdleKind {
  const entries = Object.entries(t.idle) as Array<[IdleKind, number]>;
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  if (total <= 0) return 'sit';
  let roll = rng() * total;
  for (const [kind, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return kind;
  }
  return 'sit';
}

function clampRange(x: number, range: { min: number; max: number }): number {
  return Math.max(range.min, Math.min(range.max, x));
}

function moveToward(pet: HideoutPetState, target: number, dt: number, speed: number, easing: number): void {
  const delta = target - pet.x;
  const step = Math.max(-MAX_SPEED_PX_PER_MS * speed * dt, Math.min(MAX_SPEED_PX_PER_MS * speed * dt, delta * (1 - Math.exp(-dt * easing * speed))));
  pet.x += step;
  pet.walking = Math.abs(delta) > 3;
  if (Math.abs(step) > 0.02) pet.facing = step > 0 ? 1 : -1;
}

export function stepHideoutPet(pet: HideoutPetState, input: PetStepInput): void {
  const { dt, now, operator, range, rng } = input;
  const t = HIDEOUT_TEMPERAMENTS_BY_ID[pet.temperamentId];

  if (pet.emote && now >= pet.emote.until) pet.emote = null;

  // Momentum from quick taps: the pet slides along, bounces off the ends, and slows down.
  if (pet.momentum > 0.02) {
    pet.momentum *= Math.exp(-dt / MOMENTUM_DECAY_MS);
    pet.x += pet.facing * pet.momentum * MOMENTUM_MAX_SPEED * dt;
    if (pet.x >= range.max) { pet.x = range.max; pet.facing = -1; }
    if (pet.x <= range.min) { pet.x = range.min; pet.facing = 1; }
    pet.walking = false;
    if (pet.momentum > 0.15) return;
  } else {
    pet.momentum = 0;
  }

  // Too many spins: it reels around dizzy, or lies still while sick.
  if (now < pet.sickUntil) { pet.walking = false; pet.move = null; return; }
  if (now < pet.dizzyUntil && !pet.move) {
    if (!pet.walking || Math.abs(pet.targetX - pet.x) < 2) pet.targetX = clampRange(pet.x + (rng() - 0.5) * 120, range);
    moveToward(pet, pet.targetX, dt, t.speed * 0.5, 0.01);
    return;
  }

  // A scripted move owns the pet until it ends (a dash runs, the others stay put).
  if (pet.move) {
    if (now >= pet.move.until) {
      pet.move = null;
    } else {
      pet.walking = pet.move.kind === 'dash';
      if (pet.move.kind === 'dash') {
        pet.x += pet.facing * 0.2 * dt;
        if (pet.x >= range.max) { pet.x = range.max; pet.facing = -1; }
        if (pet.x <= range.min) { pet.x = range.min; pet.facing = 1; }
      }
      return;
    }
  }

  // Track how long the operator has been resting.
  if (operator.mode === 'rest') {
    if (pet.operatorRestingSince === null) pet.operatorRestingSince = now;
  } else {
    pet.operatorRestingSince = null;
  }

  if (pet.mode === 'call') {
    moveToward(pet, pet.targetX, dt, t.speed * 1.2, 0.006);
    if (!pet.walking && now >= pet.modeUntil) pet.mode = 'follow';
    return;
  }

  if (pet.mode === 'idle') {
    if (operator.mode === 'walk' || now >= pet.modeUntil) {
      pet.mode = 'follow';
    } else if (pet.idleKind === 'wander') {
      moveToward(pet, pet.targetX, dt, t.speed * 0.6, 0.003);
      if (!pet.walking) pet.idleKind = 'watch';
      return;
    } else {
      pet.walking = false;
      return;
    }
  }

  // Follow: trail behind the operator, with some lag and a personal space.
  const trail = input.unit * t.distance * (input.slot + 1);
  const behind = clampRange(operator.x - operator.dir * trail, range);
  moveToward(pet, behind, dt, t.speed, 0.0035);

  if (!pet.walking && pet.operatorRestingSince !== null && now - pet.operatorRestingSince >= REST_BEFORE_IDLE_MS) {
    pet.mode = 'idle';
    pet.idleKind = weightedIdle(t, rng);
    pet.modeUntil = now + 3500 + rng() * 5500;
    if (pet.idleKind === 'wander') pet.targetX = clampRange(pet.x + (rng() - 0.5) * 140, range);
    // Look the way the operator is facing when settling down.
    pet.facing = operator.dir;
  }
}

/** Rapid taps chain into a streak when each lands within this gap of the last. */
export const SPIN_STREAK_GAP_MS = 700;
export const SPIN_DIZZY_AT = 6;
export const SPIN_SICK_AT = 14;
const MOMENTUM_PER_TAP = 0.16;
const MOMENTUM_DECAY_MS = 1100;
const MOMENTUM_MAX_SPEED = 0.32;
export const SPIN_JACKPOT = 249;
const DIZZY_MS = 4500;
const SICK_MS = 9000;
const SPIN_REST_MS = 1200;

/**
 * Call once per frame. When a streak has been quiet for a moment and the visit's spin total is exactly 249,
 * the pet is super charged (returns true once). Overshooting 249 loses the chance for this visit.
 */
export function checkSpinJackpot(pet: HideoutPetState, now: number): boolean {
  if (pet.spinTotal !== SPIN_JACKPOT || now - pet.lastTapAt < SPIN_REST_MS) return false;
  pet.spinTotal += 1;
  startMove(pet, 'hop', now, 1400);
  setEmote(pet, 'charge', now, 2600);
  return true;
}

/* ------------------------------ Moves and emotes ---------------------------- */

export function startMove(pet: HideoutPetState, kind: HideoutMove, now: number, durationMs: number): void {
  pet.move = { kind, start: now, until: now + durationMs };
}

export function setEmote(pet: HideoutPetState, kind: HideoutEmote, now: number, durationMs = 1700): void {
  pet.emote = { kind, start: now, until: now + durationMs };
}

/** You tapped the pet: a happy hop and a heart. A quick second tap does a spin. */
export function tapPet(pet: HideoutPetState, now: number, momentum = true): 'pet' | 'trick' | 'dizzy' | 'sick' {
  if (now < pet.sickUntil) return 'sick';
  const trick = now - pet.lastTapAt < 450;
  pet.spinStreak = now - pet.lastTapAt < SPIN_STREAK_GAP_MS ? pet.spinStreak + 1 : 1;
  pet.spinTotal += 1;
  pet.lastTapAt = now;
  if (momentum) pet.momentum = Math.min(1, pet.momentum + MOMENTUM_PER_TAP);
  if (pet.spinStreak >= SPIN_SICK_AT) {
    pet.momentum = 0;
    pet.sickUntil = now + SICK_MS;
    pet.dizzyUntil = 0;
    pet.spinStreak = 0;
    startMove(pet, 'nap', now, SICK_MS);
    setEmote(pet, 'sick', now, SICK_MS);
    return 'sick';
  }
  if (pet.spinStreak >= SPIN_DIZZY_AT) {
    pet.dizzyUntil = now + DIZZY_MS;
    startMove(pet, 'spin', now, 900);
    setEmote(pet, 'dizzy', now, DIZZY_MS);
    return 'dizzy';
  }
  startMove(pet, trick ? 'spin' : 'hop', now, (trick ? 900 : 700) * (1 - 0.5 * pet.momentum));
  setEmote(pet, trick ? 'star' : 'heart', now);
  return trick ? 'trick' : 'pet';
}

/** You tapped the ground: the pets trot over to that spot and wait a few seconds. */
export function callPets(pets: HideoutPetState[], x: number, now: number, range: { min: number; max: number }, unit: number): void {
  pets.forEach((pet, index) => {
    if (pet.move) return;
    const side = index % 2 === 0 ? 1 : -1;
    pet.mode = 'call';
    pet.targetX = clampRange(x + side * Math.ceil(index / 2 + 0.01) * unit * 0.4, range);
    pet.modeUntil = now + 5000;
    setEmote(pet, 'spark', now, 1200);
  });
}

/* ---------------------------------- Poses ---------------------------------- */

export interface PetPose {
  /** Pixels above the ground. */
  lift: number;
  scaleX: number;
  scaleY: number;
  facing: 1 | -1;
  /** Dimmed a little while napping. */
  alpha: number;
  /** Which small thing to draw over it, if any. */
  emote: HideoutEmote | null;
  /** 0 to 1 how far the emote has faded. */
  emoteAge: number;
}

export interface GrooveInput {
  active: boolean;
  /** 0 to 1 position within the beat. */
  phase: number;
  /** 0 to 1 loudness. */
  energy: number;
}

export function petPose(pet: HideoutPetState, now: number, groove: GrooveInput, still = false): PetPose {
  const t = HIDEOUT_TEMPERAMENTS_BY_ID[pet.temperamentId];
  const pose: PetPose = { lift: 0, scaleX: 1, scaleY: 1, facing: pet.facing, alpha: 1, emote: null, emoteAge: 0 };
  if (pet.emote) {
    pose.emote = pet.emote.kind;
    pose.emoteAge = Math.min(1, (now - pet.emote.start) / Math.max(1, pet.emote.until - pet.emote.start));
  }
  if (still) return pose;

  if (now < pet.sickUntil) { pose.scaleY = 0.8; pose.alpha = 0.8; return pose; }
  if (now < pet.dizzyUntil) {
    pose.scaleX = 1 + Math.sin(now / 90) * 0.1;
    pose.lift += Math.abs(Math.sin(now / 140)) * 4;
    pose.facing = Math.sin(now / 260) >= 0 ? 1 : -1;
  }

  // Base: a little bob while walking, a sit or nap squash while resting.
  if (pet.walking) pose.lift = Math.abs(Math.sin(now / 95)) * 3.5;
  else if (pet.mode === 'idle' && pet.idleKind === 'sit') pose.scaleY = 0.93;
  else if (pet.mode === 'idle' && pet.idleKind === 'nap') { pose.scaleY = 0.82 + Math.sin(now / 700) * 0.02; pose.alpha = 0.9; }
  else if (pet.mode === 'idle' && pet.idleKind === 'sniff') pose.lift = Math.max(0, Math.sin(now / 160)) * 1.5;
  else pose.scaleY = 1 + Math.sin(now / 900 + pet.x) * 0.012;

  // Vibe to the music: hop on each beat, a little more on a lively track.
  if (groove.active && !pet.move && pet.mode !== 'idle') {
    pose.lift += Math.pow(1 - groove.phase, 2) * (3 + 7 * groove.energy) * t.groove;
  } else if (groove.active && pet.mode === 'idle' && pet.idleKind !== 'nap') {
    pose.scaleY *= 1 - Math.pow(1 - groove.phase, 2) * 0.05 * t.groove;
  }

  if (pet.move) {
    const p = Math.max(0, Math.min(1, (now - pet.move.start) / Math.max(1, pet.move.until - pet.move.start)));
    switch (pet.move.kind) {
      case 'hop': pose.lift += Math.abs(Math.sin(p * Math.PI * 3)) * 11; break;
      case 'splash': pose.lift += Math.abs(Math.sin(p * Math.PI * 4)) * 8; pose.scaleY *= 0.95 + 0.05 * Math.cos(p * Math.PI * 8); break;
      case 'spin': {
        const turn = Math.sin(p * Math.PI * 2 * 3);
        pose.scaleX = Math.max(0.12, Math.abs(turn));
        pose.facing = turn >= 0 ? pet.facing : ((pet.facing * -1) as 1 | -1);
        pose.lift += Math.abs(Math.sin(p * Math.PI)) * 6;
        break;
      }
      case 'dash': pose.lift += Math.abs(Math.sin(now / 60)) * 3; pose.scaleX = 1.08; break;
      case 'bow': pose.scaleY = 1 - Math.sin(p * Math.PI) * 0.22; pose.lift = 0; break;
      case 'sway': pose.scaleX = 1 + Math.sin(p * Math.PI * 4) * 0.06; pose.lift += Math.sin(p * Math.PI * 2) * 2; break;
      case 'sniff': pose.lift += Math.max(0, Math.sin(now / 130)) * 1.8; pose.scaleY = 0.96; break;
      case 'sit': pose.scaleY = 0.93; break;
      case 'nap': pose.scaleY = 0.82 + Math.sin(now / 650) * 0.02; pose.alpha = 0.9; break;
    }
  }
  return pose;
}
