/**
 * The rules for choice events (`data/choiceEvents.ts`): which event can come up, whether an
 * option is open, which outcome a seed rolls, and what that outcome does to the save.
 *
 * Pure: no React, no storage, no clock (callers pass `now`) and no hidden randomness. The
 * overlay previews an option with `applyChoice` using the same seed the reducer will use,
 * so what the player reads is what was paid. All payouts go through the shared policy in
 * `engine/hideoutRewards.ts`, which is what keeps events small.
 */

import {
  CHOICE_EVENTS,
  CHOICE_EVENTS_BY_ID,
  choiceClaimKey,
  type ChoiceDef,
  type ChoiceEventDef,
  type ChoiceOutcome,
} from '@/game/data/choiceEvents';
import { HIDEOUT_PROPS_BY_ID, propClaimKey, propReady } from '@/game/data/hideoutProps';
import {
  eventFits,
  eventReady,
  pickHideoutEvent,
  temperamentFor,
  type HideoutEventContext,
} from '@/game/data/hideoutEvents';
import { createRng } from '@/game/engine/math';
import { BOND_RANK_BY_ID, bondRankFor } from '@/game/engine/petGrowth';
import {
  eventsLeftToday,
  grantWithFallback,
  trimClaims,
  type RewardState,
  type SmallReward,
} from '@/game/engine/hideoutRewards';
import type { HideoutWeather, SavedLokPet } from '@/game/types';

/** The pet a choice event is about: the starter partner, else the first in your loadout, else any. */
export function eventPetFor(meta: Pick<RewardState, 'savedLokPets'> & { selectedLokPetIds?: string[] }): SavedLokPet | undefined {
  const pets = meta.savedLokPets;
  return (
    pets.find((pet) => pet.starter) ??
    pets.find((pet) => meta.selectedLokPetIds?.includes(pet.id)) ??
    pets[0]
  );
}

/** `hideoutClaims` keeps `event.<id>`; the shared picker wants plain ids. */
export function choiceHistory(claims: Record<string, number> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, at] of Object.entries(claims ?? {})) if (key.startsWith('event.')) out[key.slice('event.'.length)] = at;
  return out;
}

export interface ChoicePickContext {
  now: number;
  weather?: HideoutWeather;
  musicPlaying?: boolean;
  pet?: SavedLokPet;
}

function eventContext(ctx: ChoicePickContext): HideoutEventContext {
  return {
    hour: new Date(ctx.now).getHours(),
    weather: ctx.weather ?? 'clear',
    musicPlaying: ctx.musicPlaying ?? false,
    bondRank: ctx.pet ? bondRankFor(ctx.pet.bond).id : 'stranger',
    temperament: ctx.pet ? temperamentFor(ctx.pet.id).id : 'chill',
  };
}

/** True when the event could come up right now (conditions, cooldown and having a pet if it needs one). */
export function choiceEventAvailable(def: ChoiceEventDef, claims: Record<string, number> | undefined, ctx: ChoicePickContext): boolean {
  if (def.when.needsPet && !ctx.pet) return false;
  return eventFits(def, eventContext(ctx)) && eventReady(def, choiceHistory(claims), ctx.now);
}

/** A weighted pick among the events in `pool` that fit right now, or null when none do. */
export function pickChoiceEvent(
  pool: string,
  claims: Record<string, number> | undefined,
  ctx: ChoicePickContext,
  rng: () => number,
): ChoiceEventDef | null {
  const candidates = CHOICE_EVENTS.filter((def) => def.pools.includes(pool) && (!def.when.needsPet || ctx.pet));
  return pickHideoutEvent(eventContext(ctx), choiceHistory(claims), ctx.now, rng, candidates);
}

export type ChoiceBlock = 'pet' | 'bond';

/** Why an option is closed, or null when it is open. */
export function choiceBlock(choice: ChoiceDef, pet: SavedLokPet | undefined): ChoiceBlock | null {
  if (choice.requires?.needsPet && !pet) return 'pet';
  const minBond = choice.requires?.minBond;
  if (minBond && (!pet || BOND_RANK_BY_ID[bondRankFor(pet.bond).id].order < BOND_RANK_BY_ID[minBond].order)) return 'bond';
  return null;
}

/** Rolls an outcome by weight. */
export function rollChoiceOutcome(choice: ChoiceDef, rng: () => number): ChoiceOutcome {
  const total = choice.outcomes.reduce((sum, outcome) => sum + Math.max(0, outcome.weight), 0);
  let pick = rng() * total;
  for (const outcome of choice.outcomes) {
    pick -= Math.max(0, outcome.weight);
    if (pick <= 0) return outcome;
  }
  return choice.outcomes[choice.outcomes.length - 1]!;
}

export type ChoiceFailure = 'unknown' | 'cooldown' | 'limit' | 'pet' | 'bond' | 'prop';

export interface ChoiceResult<T extends RewardState> {
  ok: boolean;
  failure: ChoiceFailure | null;
  meta: T;
  outcome: ChoiceOutcome | null;
  /** What was really paid (pet XP in scaled units). */
  applied: SmallReward;
  /** The rare outcome was refused by the limits and its fallback was paid instead. */
  usedFallback: boolean;
}

export interface ApplyChoiceContext {
  now: number;
  petId?: string;
  /** The prop that offered this event, whose own daily claim is stamped too. */
  propId?: string;
  elixirCap: number;
}

const fail = <T extends RewardState>(meta: T, failure: ChoiceFailure): ChoiceResult<T> => ({ ok: false, failure, meta, outcome: null, applied: {}, usedFallback: false });

/** The whole effect of picking one option: validation, the rolled outcome, the payout and the claims. */
export function applyChoice<T extends RewardState>(meta: T, eventId: string, choiceId: string, seed: number, ctx: ApplyChoiceContext): ChoiceResult<T> {
  const def = CHOICE_EVENTS_BY_ID[eventId];
  const choice = def?.choices.find((candidate) => candidate.id === choiceId);
  if (!def || !choice) return fail(meta, 'unknown');

  const claims = meta.hideoutClaims ?? {};
  if (!eventReady(def, choiceHistory(claims), ctx.now)) return fail(meta, 'cooldown');
  if (eventsLeftToday(meta.hideoutLedger, ctx.now) <= 0) return fail(meta, 'limit');

  const pet = ctx.petId ? meta.savedLokPets.find((candidate) => candidate.id === ctx.petId) : undefined;
  const block = choiceBlock(choice, pet);
  if (block) return fail(meta, block);

  if (ctx.propId) {
    const prop = HIDEOUT_PROPS_BY_ID[ctx.propId];
    if (!prop || prop.action.kind !== 'event' || !propReady(prop, claims, ctx.now)) return fail(meta, 'prop');
  }

  const outcome = rollChoiceOutcome(choice, createRng(seed));
  const paid = grantWithFallback(meta, outcome.reward ?? {}, outcome.fallback, {
    now: ctx.now,
    rare: outcome.rare === true,
    petId: pet?.id,
    bondSource: 'event',
    countsAsEvent: true,
    elixirCap: ctx.elixirCap,
  });
  const stamped: Record<string, number> = { ...paid.meta.hideoutClaims, [choiceClaimKey(def.id)]: ctx.now };
  if (ctx.propId) stamped[propClaimKey(ctx.propId)] = ctx.now;
  return {
    ok: true,
    failure: null,
    meta: { ...paid.meta, hideoutClaims: trimClaims(stamped) },
    outcome,
    applied: paid.applied,
    usedFallback: paid.usedFallback,
  };
}
