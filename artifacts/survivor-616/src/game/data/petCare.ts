/**
 * Things to do with a LokPet in the hideout, beyond the once-a-day pet. Each verb is a
 * record; add a row (and its text in `src/locales/en.json`) and it shows up in the play
 * bar. Nothing here touches the save: `applyPetCare` is pure and the reducer and the UI
 * both call it, so the toast shows exactly what the reducer pays.
 *
 * A pet's temperament (from `data/hideoutEvents.ts`) decides how much it likes a verb,
 * which scales the XP. Bond now does something small: it unlocks the more adventurous
 * verbs, and it raises the odds of the rare finds (`engine/hideoutRewards.ts#bondLuck`).
 * Everything is capped per day and per item by the shared reward policy.
 */

import type { MessageKey } from '@/lib/i18n';
import {
  eventReady,
  temperamentFor,
  timeOfDayFor,
  type HideoutEmote,
  type HideoutMove,
  type HideoutTemperamentId,
  type HideoutTimeOfDay,
} from '@/game/data/hideoutEvents';
import { BOND_RANK_BY_ID, bondRankFor, type BondRankId } from '@/game/engine/petGrowth';
import {
  bondLuck,
  grantSmallReward,
  grantWithFallback,
  type RewardState,
  type SmallReward,
} from '@/game/engine/hideoutRewards';
import { createRng } from '@/game/engine/math';
import type { SavedLokPet } from '@/game/types';

export type PetMood = 'loved' | 'liked' | 'meh';

export interface PetCareFindRow {
  weight: number;
  reward: SmallReward;
  textKey?: MessageKey;
}

export interface PetCareFind {
  rows: PetCareFindRow[];
  rare?: { baseChance: number; reward: SmallReward; fallback: SmallReward; textKey: MessageKey };
}

export interface PetCareVerbDef {
  id: string;
  labelKey: MessageKey;
  hintKey: MessageKey;
  /** `{{pet}}` and `{{you}}` are filled in at display time. */
  lineKeys: Record<PetMood, MessageKey>;
  move: HideoutMove;
  emote: HideoutEmote;
  durationMs: number;
  /** Per pet. */
  cooldownMs: number;
  minBond?: BondRankId;
  when?: { music?: boolean; timeOfDay?: HideoutTimeOfDay[] };
  affinity: Partial<Record<HideoutTemperamentId, 'loves' | 'meh'>>;
  reward: {
    /** Base (unscaled) XP before the mood multiplier. */
    exp: number;
    bond: boolean;
    find?: PetCareFind;
  };
}

const HOUR = 60 * 60 * 1000;

export const PET_CARE_VERBS: PetCareVerbDef[] = [
  {
    id: 'scratch', labelKey: 'hideout.care.scratch.label', hintKey: 'hideout.care.scratch.hint',
    lineKeys: { loved: 'hideout.care.scratch.loved', liked: 'hideout.care.scratch.liked', meh: 'hideout.care.scratch.meh' },
    move: 'sway', emote: 'heart', durationMs: 3200, cooldownMs: 4 * HOUR,
    affinity: { shy: 'loves', sleepy: 'loves', bold: 'meh' },
    reward: { exp: 4, bond: true },
  },
  {
    id: 'fetch', labelKey: 'hideout.care.fetch.label', hintKey: 'hideout.care.fetch.hint',
    lineKeys: { loved: 'hideout.care.fetch.loved', liked: 'hideout.care.fetch.liked', meh: 'hideout.care.fetch.meh' },
    move: 'dash', emote: 'bang', durationMs: 2800, cooldownMs: 3 * HOUR,
    affinity: { bouncy: 'loves', bold: 'loves', sleepy: 'meh' },
    reward: { exp: 5, bond: true },
  },
  {
    id: 'boogie', labelKey: 'hideout.care.boogie.label', hintKey: 'hideout.care.boogie.hint',
    lineKeys: { loved: 'hideout.care.boogie.loved', liked: 'hideout.care.boogie.liked', meh: 'hideout.care.boogie.meh' },
    move: 'spin', emote: 'note', durationMs: 4200, cooldownMs: 6 * HOUR,
    when: { music: true },
    affinity: { bouncy: 'loves', shy: 'meh' },
    reward: { exp: 6, bond: true },
  },
  {
    id: 'snack-break', labelKey: 'hideout.care.snack-break.label', hintKey: 'hideout.care.snack-break.hint',
    lineKeys: { loved: 'hideout.care.snack-break.loved', liked: 'hideout.care.snack-break.liked', meh: 'hideout.care.snack-break.meh' },
    move: 'hop', emote: 'drop', durationMs: 2600, cooldownMs: 8 * HOUR,
    affinity: { chill: 'loves' },
    reward: { exp: 5, bond: true },
  },
  {
    id: 'nap-together', labelKey: 'hideout.care.nap-together.label', hintKey: 'hideout.care.nap-together.hint',
    lineKeys: { loved: 'hideout.care.nap-together.loved', liked: 'hideout.care.nap-together.liked', meh: 'hideout.care.nap-together.meh' },
    move: 'nap', emote: 'zzz', durationMs: 6000, cooldownMs: 12 * HOUR,
    when: { timeOfDay: ['dusk', 'night'] },
    affinity: { sleepy: 'loves', bouncy: 'meh' },
    reward: { exp: 6, bond: true },
  },
  {
    id: 'sniff-hunt', labelKey: 'hideout.care.sniff-hunt.label', hintKey: 'hideout.care.sniff-hunt.hint',
    lineKeys: { loved: 'hideout.care.sniff-hunt.loved', liked: 'hideout.care.sniff-hunt.liked', meh: 'hideout.care.sniff-hunt.meh' },
    move: 'sniff', emote: 'bang', durationMs: 3600, cooldownMs: 20 * HOUR,
    minBond: 'familiar',
    affinity: { bold: 'loves', shy: 'meh' },
    reward: {
      exp: 5,
      bond: true,
      find: {
        rows: [
          { weight: 8, reward: { cred: 6 } },
          { weight: 3, reward: { cred: 12 } },
          { weight: 1, reward: { lokPetTreats: 1 } },
        ],
        rare: { baseChance: 0.03, reward: { petElixirs: 1 }, fallback: { cred: 6 }, textKey: 'hideout.care.sniff-hunt.rare' },
      },
    },
  },
];

export const PET_CARE_VERBS_BY_ID: Record<string, PetCareVerbDef> = Object.fromEntries(PET_CARE_VERBS.map((verb) => [verb.id, verb]));

/** Claim key used in `SavedLokPet.hideoutEvents`, next to the passive events. */
export const careClaimKey = (verbId: string): string => `care.${verbId}`;

export const MOOD_EXP_MULTIPLIER: Record<PetMood, number> = { loved: 1.5, liked: 1, meh: 0.6 };

export function moodFor(def: PetCareVerbDef, petId: string): PetMood {
  const affinity = def.affinity[temperamentFor(petId).id];
  return affinity === 'loves' ? 'loved' : affinity === 'meh' ? 'meh' : 'liked';
}

export type CareBlock = 'cooldown' | 'bond' | 'music' | 'time';

export interface CareContext {
  now: number;
  musicPlaying: boolean;
}

/** Why a verb cannot be used right now, or null when it can. */
export function careVerbBlock(def: PetCareVerbDef, pet: Pick<SavedLokPet, 'id' | 'bond' | 'hideoutEvents'>, ctx: CareContext): CareBlock | null {
  if (def.minBond && BOND_RANK_BY_ID[bondRankFor(pet.bond).id].order < BOND_RANK_BY_ID[def.minBond].order) return 'bond';
  if (def.when?.music !== undefined && def.when.music !== ctx.musicPlaying) return 'music';
  if (def.when?.timeOfDay && !def.when.timeOfDay.includes(timeOfDayFor(new Date(ctx.now).getHours()))) return 'time';
  const gate = { id: careClaimKey(def.id), cooldownMs: def.cooldownMs };
  if (!eventReady(gate, pet.hideoutEvents, ctx.now)) return 'cooldown';
  return null;
}

/** Milliseconds until the verb's cooldown ends for this pet (0 when ready). */
export function careCooldownLeftMs(def: PetCareVerbDef, pet: Pick<SavedLokPet, 'hideoutEvents'>, now: number): number {
  const last = pet.hideoutEvents?.[careClaimKey(def.id)];
  return last === undefined ? 0 : Math.max(0, def.cooldownMs - (now - last));
}

export interface PetCareFindRoll {
  reward: SmallReward;
  fallback?: SmallReward;
  rare: boolean;
  textKey?: MessageKey;
}

/** Rolls a find in a fixed order (rare roll, then row roll) so a seed always gives the same answer. */
export function rollPetCareFind(find: PetCareFind, rng: () => number, luck: number): PetCareFindRoll | null {
  const rareRoll = rng();
  const rowRoll = rng();
  if (find.rare && rareRoll < Math.min(0.5, find.rare.baseChance * Math.max(1, luck))) {
    return { reward: find.rare.reward, fallback: find.rare.fallback, rare: true, textKey: find.rare.textKey };
  }
  const total = find.rows.reduce((sum, row) => sum + Math.max(0, row.weight), 0);
  if (total <= 0) return null;
  let pick = rowRoll * total;
  for (const row of find.rows) {
    pick -= Math.max(0, row.weight);
    if (pick <= 0) return { reward: row.reward, rare: false, textKey: row.textKey };
  }
  const last = find.rows[find.rows.length - 1];
  return last ? { reward: last.reward, rare: false, textKey: last.textKey } : null;
}

export interface PetCareOutcome<T extends RewardState> {
  ok: boolean;
  block: CareBlock | 'unknown' | null;
  meta: T;
  mood: PetMood;
  /** Everything that was actually paid (XP is in scaled units). */
  applied: SmallReward;
  /** The rare-find text, when a rare find landed. */
  rareTextKey?: MessageKey;
}

/**
 * The whole effect of one verb on one pet: cooldown check, XP and bond (scaled by mood),
 * and the find table, all through the shared reward policy. Returns the new meta; callers
 * that only want a preview ignore it.
 */
export function applyPetCare<T extends RewardState>(
  meta: T,
  petId: string,
  verbId: string,
  seed: number,
  ctx: CareContext & { elixirCap: number },
): PetCareOutcome<T> {
  const def = PET_CARE_VERBS_BY_ID[verbId];
  const pet = meta.savedLokPets.find((candidate) => candidate.id === petId);
  if (!def || !pet) return { ok: false, block: 'unknown', meta, mood: 'liked', applied: {} };
  const block = careVerbBlock(def, pet, ctx);
  const mood = moodFor(def, pet.id);
  if (block) return { ok: false, block, meta, mood, applied: {} };

  const rng = createRng(seed);
  const exp = Math.round(def.reward.exp * MOOD_EXP_MULTIPLIER[mood]);
  const base = grantSmallReward(meta, { petExp: exp, bond: def.reward.bond }, { now: ctx.now, petId, bondSource: 'play', elixirCap: ctx.elixirCap });
  let next = base.meta;
  const applied: SmallReward = { ...base.applied };
  let rareTextKey: MessageKey | undefined;

  const find = def.reward.find ? rollPetCareFind(def.reward.find, rng, bondLuck(meta.savedLokPets)) : null;
  if (find) {
    const found = grantWithFallback(next, find.reward, find.fallback, { now: ctx.now, rare: find.rare, elixirCap: ctx.elixirCap });
    next = found.meta;
    for (const key of ['cred', 'cardCredits', 'lokPetTreats', 'petElixirs', 'skeletonKeys'] as const) {
      const amount = found.applied[key];
      if (amount) applied[key] = (applied[key] ?? 0) + amount;
    }
    if (find.rare && !found.usedFallback && found.paid) rareTextKey = find.textKey;
  }

  // Remember when this verb was last used on this pet (newest 40, like the passive events).
  const claim = careClaimKey(def.id);
  const stamped = next.savedLokPets.map((candidate) => {
    if (candidate.id !== petId) return candidate;
    const seen = { ...(candidate.hideoutEvents ?? {}), [claim]: ctx.now };
    const kept = Object.entries(seen).sort((a, b) => b[1] - a[1]).slice(0, 40);
    return { ...candidate, hideoutEvents: Object.fromEntries(kept) };
  });
  return { ok: true, block: null, meta: { ...next, savedLokPets: stamped }, mood, applied, rareTextKey };
}
