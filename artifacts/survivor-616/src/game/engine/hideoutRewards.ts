/**
 * The one place small hideout rewards are granted. Props, pet play and choice
 * events all end here, so the daily caps and the rare-find limits cannot be
 * bypassed by adding another source.
 *
 * Pure: no React, no storage, no clock (callers pass `now`) and no randomness
 * (callers roll first, then ask for the grant). A UI can call it against the
 * current meta to preview a payout and throw the result away; the reducer calls it
 * again and keeps the result, so the preview and the real payout always agree.
 *
 * Policy, in one screen:
 * - Common rewards are small and capped per local day (`DAILY_CAP`), and each single
 *   grant is capped too (`PER_GRANT_MAX`).
 * - A "rare" find (flagged by the caller after its own roll) is allowed at most once
 *   per day and once per cooldown for each kind of item. When it is blocked the caller
 *   gets `rareBlocked` and applies the authored fallback instead.
 * - Pet XP goes through `applyPetExp` (so level caps hold) and bond through `growPet`
 *   (so the 12-a-day bond cap holds). Nothing here ever touches `lootTokens`.
 */

import { bondDayKey, bondRankFor, growPet, scalePetExp, type BondSource } from '@/game/engine/petGrowth';
import type { HideoutLedger, MetaState } from '@/game/types';

export type RewardKey = 'cred' | 'cardCredits' | 'lokPetTreats' | 'petElixirs' | 'skeletonKeys';
export type LedgerKey = RewardKey | 'petExp';

export interface SmallReward {
  cred?: number;
  cardCredits?: number;
  lokPetTreats?: number;
  petElixirs?: number;
  skeletonKeys?: number;
  /** Base (unscaled) pet XP; the policy scales it with `scalePetExp`. */
  petExp?: number;
  /** Also tick the pet's bond (still bounded by the daily bond cap). */
  bond?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Most of each thing the hideout can hand out in one local day (pet XP is in scaled units). */
export const DAILY_CAP: Record<LedgerKey, number> = {
  cred: 60,
  cardCredits: 3,
  lokPetTreats: 2,
  petElixirs: 1,
  skeletonKeys: 0,
  petExp: 300,
};

/** Most of each thing a single grant can carry. */
export const PER_GRANT_MAX: Record<LedgerKey, number> = {
  cred: 15,
  cardCredits: 2,
  lokPetTreats: 1,
  petElixirs: 1,
  skeletonKeys: 1,
  petExp: 150,
};

/** Rare finds per local day, across every source. */
export const RARE_DAILY_MAX = 1;

/** How long a given kind of item must wait between rare finds. */
export const RARE_COOLDOWN_MS: Partial<Record<RewardKey, number>> = {
  petElixirs: 3 * DAY_MS,
  cardCredits: 2 * DAY_MS,
  lokPetTreats: 2 * DAY_MS,
  skeletonKeys: 7 * DAY_MS,
};

/** Choice events that can pay out in one local day. */
export const EVENTS_DAILY_MAX = 3;

/** Most claim keys kept in `hideoutClaims`. */
export const MAX_CLAIMS = 120;

export const REWARD_KEYS: RewardKey[] = ['cred', 'cardCredits', 'lokPetTreats', 'petElixirs', 'skeletonKeys'];

/**
 * Bond finally matters a little: the closer your best-bonded pet, the better the odds
 * of a rare find (up to double at Soulbound). It never changes the everyday payout.
 */
export function bondLuck(pets: ReadonlyArray<{ bond?: number }>): number {
  const best = pets.reduce((top, pet) => Math.max(top, bondRankFor(pet.bond).order), 0);
  return 1 + 0.25 * best;
}

export function emptyLedger(day = ''): HideoutLedger {
  return { day, granted: {}, events: 0, rare: 0 };
}

/** The ledger for `now`: yesterday's counters start fresh. */
export function ledgerFor(ledger: HideoutLedger | undefined, now: number): HideoutLedger {
  const day = bondDayKey(now);
  return ledger && ledger.day === day ? ledger : emptyLedger(day);
}

export function eventsLeftToday(ledger: HideoutLedger | undefined, now: number): number {
  return Math.max(0, EVENTS_DAILY_MAX - ledgerFor(ledger, now).events);
}

/** Most recent claim keys win when the record grows past its cap. */
export function trimClaims(claims: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(claims).sort((a, b) => b[1] - a[1]).slice(0, MAX_CLAIMS));
}

export type RewardState = Pick<
  MetaState,
  'cred' | 'cardCredits' | 'lokPetTreats' | 'petElixirs' | 'skeletonKeys' | 'savedLokPets' | 'hideoutClaims' | 'hideoutLedger' | 'eventBuff'
>;

export interface GrantContext {
  now: number;
  /** True when this reward is a rare find (the caller already rolled for it). */
  rare?: boolean;
  /** The pet that receives `petExp` and `bond`, if any. */
  petId?: string;
  /** Which bond source the tick counts as (defaults to `event`). */
  bondSource?: BondSource;
  /** Count this grant as one choice event against the daily event limit. */
  countsAsEvent?: boolean;
  /** Elixir stock limit; lives in the store, so it is passed in. */
  elixirCap: number;
}

export interface GrantResult<T extends RewardState> {
  meta: T;
  /** What was really paid out (pet XP in scaled units). */
  applied: SmallReward;
  /** True when something was paid out. */
  paid: boolean;
  /** A rare find that the daily or per-item limits refused; apply the fallback instead. */
  rareBlocked: boolean;
  /** Keys whose requested amount was reduced by a cap. */
  clipped: LedgerKey[];
}

function wanted(reward: SmallReward, key: LedgerKey): number {
  const raw = key === 'petExp' ? scalePetExp(reward.petExp ?? 0) : reward[key] ?? 0;
  return Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
}

export function grantSmallReward<T extends RewardState>(meta: T, reward: SmallReward, ctx: GrantContext): GrantResult<T> {
  const now = ctx.now;
  const ledger = ledgerFor(meta.hideoutLedger, now);
  const rare = ctx.rare === true;
  const claims = meta.hideoutClaims ?? {};
  const requested = REWARD_KEYS.filter((key) => wanted(reward, key) > 0);

  if (rare) {
    const blocked =
      ledger.rare >= RARE_DAILY_MAX ||
      requested.some((key) => {
        const wait = RARE_COOLDOWN_MS[key];
        const last = claims[`rare.${key}`];
        return wait !== undefined && last !== undefined && now - last < wait;
      });
    if (blocked) return { meta, applied: {}, paid: false, rareBlocked: true, clipped: [] };
  }

  const applied: SmallReward = {};
  const clipped: LedgerKey[] = [];
  const granted = { ...ledger.granted };
  const keys: LedgerKey[] = [...REWARD_KEYS, 'petExp'];
  const next: Record<string, unknown> = {};

  for (const key of keys) {
    const ask = wanted(reward, key);
    if (ask <= 0) continue;
    if (key === 'petExp' && !ctx.petId) continue;
    // A rare find is bounded by its own limits, not the everyday allowance.
    const room = rare ? PER_GRANT_MAX[key] : Math.max(0, DAILY_CAP[key] - (granted[key] ?? 0));
    let give = Math.min(ask, PER_GRANT_MAX[key], room);
    if (key === 'petElixirs') give = Math.min(give, Math.max(0, ctx.elixirCap - meta.petElixirs));
    if (give < ask) clipped.push(key);
    if (give <= 0) continue;
    granted[key] = (granted[key] ?? 0) + give;
    if (key === 'petExp') applied.petExp = give;
    else {
      applied[key] = give;
      next[key] = meta[key] + give;
    }
  }

  let savedLokPets = meta.savedLokPets;
  const wantsBond = reward.bond === true && Boolean(ctx.petId);
  if (ctx.petId && (applied.petExp || wantsBond)) {
    savedLokPets = meta.savedLokPets.map((pet) => {
      if (pet.id !== ctx.petId) return pet;
      const grown = growPet(pet, {
        exp: applied.petExp ?? 0,
        bondSource: wantsBond ? ctx.bondSource ?? 'event' : undefined,
        now,
      });
      if (grown.entry && grown.entry.bondGained > 0) applied.bond = true;
      return grown.pet;
    });
  }

  const paid = REWARD_KEYS.some((key) => (applied[key] ?? 0) > 0) || (applied.petExp ?? 0) > 0 || applied.bond === true;
  const nextClaims = { ...claims };
  let rareCount = ledger.rare;
  if (rare && paid) {
    rareCount += 1;
    for (const key of REWARD_KEYS) if ((applied[key] ?? 0) > 0) nextClaims[`rare.${key}`] = now;
  }

  const nextLedger: HideoutLedger = {
    day: ledger.day,
    granted,
    events: ledger.events + (ctx.countsAsEvent ? 1 : 0),
    rare: rareCount,
  };

  return {
    meta: { ...meta, ...next, savedLokPets, hideoutClaims: nextClaims, hideoutLedger: nextLedger } as T,
    applied,
    paid,
    rareBlocked: false,
    clipped,
  };
}

/**
 * Grants `reward`; when it is a rare find that the limits refuse, grants `fallback`
 * (a plain, everyday reward) instead so the player still gets something.
 */
export function grantWithFallback<T extends RewardState>(
  meta: T,
  reward: SmallReward,
  fallback: SmallReward | undefined,
  ctx: GrantContext,
): GrantResult<T> & { usedFallback: boolean } {
  const first = grantSmallReward(meta, reward, ctx);
  if (!first.rareBlocked) return { ...first, usedFallback: false };
  const second = grantSmallReward(meta, fallback ?? {}, { ...ctx, rare: false });
  return { ...second, usedFallback: true };
}
