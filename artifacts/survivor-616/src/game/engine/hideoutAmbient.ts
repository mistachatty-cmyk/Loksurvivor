/**
 * Hideout ambient life: pure rules. No canvas, no React, no clock (callers pass `dt` and
 * `now`, in strip milliseconds) and no hidden randomness.
 */
import {
  AMBIENT_PICKUPS,
  AMBIENT_TIMING,
  AMBIENT_VISITORS,
  AMBIENT_VISITORS_BY_ID,
  type AmbientPickupDef,
  type AmbientReaction,
  type AmbientVisitorDef,
} from '@/game/data/hideoutAmbient';
import type { HideoutTemperamentId } from '@/game/data/hideoutEvents';

export interface Range { min: number; max: number }

export interface AmbientActor {
  uid: number;
  kindId: string;
  x: number;
  /** Direction of travel. */
  dir: 1 | -1;
  /** Strip time it arrived. */
  born: number;
  /** Creepers turn around and leave at this time. */
  leaveAt: number;
  /** Strip time it was squashed, or null while alive. */
  squashedAt: number | null;
  /** Pets that already reacted to it, so each reacts once. */
  reactedPetIds: string[];
}

export interface AmbientPickup {
  uid: number;
  kindId: string;
  x: number;
  born: number;
}

function weighted<T>(rows: readonly T[], weight: (row: T) => number, roll: number): T | undefined {
  const total = rows.reduce((sum, row) => sum + Math.max(0, weight(row)), 0);
  let pick = roll * total;
  for (const row of rows) {
    pick -= Math.max(0, weight(row));
    if (pick <= 0) return row;
  }
  return rows[rows.length - 1];
}

const between = (span: readonly [number, number], roll: number): number => span[0] + (span[1] - span[0]) * roll;

/** When the next visitor should arrive after `now`. */
export const nextVisitorAt = (now: number, rng: () => number): number => now + between(AMBIENT_TIMING.visitorGapMs, rng());

/** When the next pickup should turn up after `now`. */
export const nextPickupAt = (now: number, rng: () => number): number => now + between(AMBIENT_TIMING.pickupGapMs, rng());

/** Picks a visitor, avoiding the one that just came when there is a choice. */
export function pickVisitor(rng: () => number, lastKindId: string | null = null): AmbientVisitorDef {
  const pool = AMBIENT_VISITORS.length > 1 ? AMBIENT_VISITORS.filter((v) => v.id !== lastKindId) : AMBIENT_VISITORS;
  return weighted(pool, (v) => v.weight, rng())!;
}

export function spawnVisitor(uid: number, def: AmbientVisitorDef, range: Range, rng: () => number, now: number): AmbientActor {
  const dir: 1 | -1 = rng() < 0.5 ? 1 : -1;
  const wander = def.motion === 'creep' ? 7_000 + rng() * 8_000 : 0;
  return {
    uid, kindId: def.id, dir, born: now, leaveAt: now + wander, squashedAt: null, reactedPetIds: [],
    x: dir === 1 ? range.min - 20 : range.max + 20,
  };
}

/** Moves an actor. Returns true once it has left the strip and can be dropped. */
export function stepActor(actor: AmbientActor, dt: number, now: number, range: Range): boolean {
  const def = AMBIENT_VISITORS_BY_ID[actor.kindId];
  if (!def) return true;
  if (actor.squashedAt !== null) return now - actor.squashedAt > AMBIENT_TIMING.squashMs + 400;
  if (def.motion === 'creep' && now >= actor.leaveAt && actor.leaveAt > actor.born) {
    // Time to go: head for the nearest edge.
    actor.dir = actor.x < (range.min + range.max) / 2 ? -1 : 1;
  } else if (def.motion === 'creep') {
    // Wander in from the edge, then pace about: turn at the inner bounds.
    if (actor.x < range.min + 30 && actor.dir === -1) actor.dir = 1;
    if (actor.x > range.max - 30 && actor.dir === 1) actor.dir = -1;
  }
  actor.x += actor.dir * def.speed * dt;
  const leaving = def.motion === 'cross' || now >= actor.leaveAt;
  return leaving && (actor.x < range.min - 40 || actor.x > range.max + 40);
}

/** Squashes a squashable, living visitor. Returns true when it was squashed. */
export function squashActor(actor: AmbientActor, now: number): boolean {
  const def = AMBIENT_VISITORS_BY_ID[actor.kindId];
  if (!def?.squashable || actor.squashedAt !== null) return false;
  actor.squashedAt = now;
  return true;
}

/** 0 to 1 through the squash animation, or null while alive. */
export function squashProgress(actor: AmbientActor, now: number): number | null {
  if (actor.squashedAt === null) return null;
  return Math.min(1, (now - actor.squashedAt) / AMBIENT_TIMING.squashMs);
}

/** How a pet of `temperament` reacts to this visitor. */
export function reactionFor(def: AmbientVisitorDef, temperament: HideoutTemperamentId): AmbientReaction {
  return def.reactions[temperament];
}

/**
 * Which pets (by id) should react right now: close enough and not yet reacted. Marks them
 * as reacted so each pet reacts to an actor once.
 */
export function petsToReact(actor: AmbientActor, pets: ReadonlyArray<{ id: string; x: number }>, unit: number): string[] {
  if (actor.squashedAt !== null) return [];
  const radius = unit * AMBIENT_TIMING.reactRadiusUnits;
  const out: string[] = [];
  for (const pet of pets) {
    if (actor.reactedPetIds.includes(pet.id) || Math.abs(pet.x - actor.x) > radius) continue;
    actor.reactedPetIds.push(pet.id);
    out.push(pet.id);
  }
  return out;
}

export function spawnPickup(uid: number, range: Range, rng: () => number, now: number): AmbientPickup {
  const def = weighted(AMBIENT_PICKUPS, (p) => p.weight, rng())!;
  return { uid, kindId: def.id, x: range.min + 20 + rng() * (range.max - range.min - 40), born: now };
}

export const pickupExpired = (pickup: AmbientPickup, now: number): boolean => now - pickup.born > AMBIENT_TIMING.pickupLifeMs;

/** The pickup within reach of `x`, if any (the nearest wins). */
export function pickupWithinReach(pickups: readonly AmbientPickup[], x: number, unit: number): AmbientPickup | undefined {
  const reach = Math.max(10, unit * AMBIENT_TIMING.pickupReachUnits);
  return pickups
    .filter((p) => Math.abs(p.x - x) <= reach)
    .sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
}

export const pickupDef = (pickup: AmbientPickup): AmbientPickupDef | undefined => AMBIENT_PICKUPS.find((p) => p.id === pickup.kindId);
