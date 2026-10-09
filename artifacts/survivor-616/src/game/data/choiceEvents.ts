/**
 * Choice events: a small scene, a few options, and a weighted outcome for each option.
 * Every event is a record; add one (and its text in en.json) and
 * it enters the pool it names. Where an event can come up is a separate, equally small
 * table of triggers (`CHOICE_TRIGGERS`), so a new place to meet one is one more row.
 *
 * Nothing here pays anything itself. A chosen outcome carries a `SmallReward`, and the
 * reducer hands it to the shared policy in `engine/hideoutRewards.ts`, which owns the daily
 * caps, the three-events-a-day limit and the rare-find limits. Rare outcomes are written
 * at a few percent and always carry a plain `fallback`, so a blocked rare still pays.
 *
 * Text is stored as keys into `src/locales/en.json` (`{{pet}}` is the pet's call name).
 * An event or option that mentions `{{pet}}` must be gated on having a pet.
 */

import type { MessageKey } from '@/lib/i18n';
import type { HideoutEventDef, EventGate } from '@/game/data/hideoutEvents';
import type { BondRankId } from '@/game/engine/petGrowth';
import type { SmallReward } from '@/game/engine/hideoutRewards';

export interface ChoiceOutcome {
  id: string;
  weight: number;
  /** A rare find: bounded by the daily and per-item rare limits. */
  rare?: boolean;
  textKey: MessageKey;
  reward?: SmallReward;
  /** Paid instead when a rare outcome is refused by the limits. */
  fallback?: SmallReward;
}

export interface ChoiceDef {
  id: string;
  labelKey: MessageKey;
  requires?: { minBond?: BondRankId; needsPet?: boolean };
  outcomes: ChoiceOutcome[];
}

export interface ChoiceEventDef extends EventGate {
  titleKey: MessageKey;
  bodyKey: MessageKey;
  /** Which trigger pools can offer it. */
  pools: string[];
  when: HideoutEventDef['when'] & { needsPet?: boolean };
  choices: ChoiceDef[];
}

export type ChoiceTriggerSource = 'hub-room' | 'run-launch' | 'strip-walk' | 'idle';

/** A place an event can come up. Chance is per attempt, before the "Rarely" setting. */
export interface ChoiceTrigger {
  id: string;
  source: ChoiceTriggerSource;
  /** For `hub-room`: the `HUB_ROOMS` id you are walking into. */
  roomId?: string;
  chance: number;
  pool: string;
}

const HOUR = 60 * 60 * 1000;

export const CHOICE_EVENTS: ChoiceEventDef[] = [
  {
    id: 'stray-at-the-door', pools: ['idle', 'alley'], weight: 5, cooldownMs: 12 * HOUR,
    titleKey: 'hideout.event.stray-at-the-door.title', bodyKey: 'hideout.event.stray-at-the-door.body',
    when: { timeOfDay: ['dusk', 'night'] },
    choices: [
      {
        id: 'feed', labelKey: 'hideout.event.stray-at-the-door.c.feed',
        outcomes: [
          { id: '1', weight: 70, textKey: 'hideout.event.stray-at-the-door.o.feed.1', reward: { cred: 6 } },
          { id: '2', weight: 27, textKey: 'hideout.event.stray-at-the-door.o.feed.2' },
          { id: '3', weight: 3, textKey: 'hideout.event.stray-at-the-door.o.feed.3', rare: true, reward: { lokPetTreats: 1 }, fallback: { cred: 6 } },
        ],
      },
      {
        id: 'shoo', labelKey: 'hideout.event.stray-at-the-door.c.shoo',
        outcomes: [
          { id: '1', weight: 100, textKey: 'hideout.event.stray-at-the-door.o.shoo.1' },
        ],
      },
      {
        id: 'pet', labelKey: 'hideout.event.stray-at-the-door.c.pet', requires: { needsPet: true, minBond: 'friend' },
        outcomes: [
          { id: '1', weight: 75, textKey: 'hideout.event.stray-at-the-door.o.pet.1', reward: { petExp: 8, bond: true } },
          { id: '2', weight: 25, textKey: 'hideout.event.stray-at-the-door.o.pet.2', reward: { cred: 8 } },
        ],
      },
    ],
  },
  {
    id: 'dropped-satchel', pools: ['idle', 'walk', 'alley'], weight: 4, cooldownMs: 10 * HOUR,
    titleKey: 'hideout.event.dropped-satchel.title', bodyKey: 'hideout.event.dropped-satchel.body',
    when: {  },
    choices: [
      {
        id: 'open', labelKey: 'hideout.event.dropped-satchel.c.open',
        outcomes: [
          { id: '1', weight: 60, textKey: 'hideout.event.dropped-satchel.o.open.1', reward: { cred: 8 } },
          { id: '2', weight: 37, textKey: 'hideout.event.dropped-satchel.o.open.2' },
          { id: '3', weight: 3, textKey: 'hideout.event.dropped-satchel.o.open.3', rare: true, reward: { cardCredits: 2 }, fallback: { cred: 8 } },
        ],
      },
      {
        id: 'hand-in', labelKey: 'hideout.event.dropped-satchel.c.hand-in',
        outcomes: [
          { id: '1', weight: 100, textKey: 'hideout.event.dropped-satchel.o.hand-in.1', reward: { cred: 5 } },
        ],
      },
      {
        id: 'sniff', labelKey: 'hideout.event.dropped-satchel.c.sniff', requires: { needsPet: true },
        outcomes: [
          { id: '1', weight: 70, textKey: 'hideout.event.dropped-satchel.o.sniff.1', reward: { cred: 8, petExp: 5 } },
          { id: '2', weight: 30, textKey: 'hideout.event.dropped-satchel.o.sniff.2' },
        ],
      },
    ],
  },
  {
    id: 'busker-on-the-corner', pools: ['travel'], weight: 4, cooldownMs: 8 * HOUR,
    titleKey: 'hideout.event.busker-on-the-corner.title', bodyKey: 'hideout.event.busker-on-the-corner.body',
    when: {  },
    choices: [
      {
        id: 'listen', labelKey: 'hideout.event.busker-on-the-corner.c.listen',
        outcomes: [
          { id: '1', weight: 100, textKey: 'hideout.event.busker-on-the-corner.o.listen.1', reward: { cred: 3 } },
        ],
      },
      {
        id: 'request', labelKey: 'hideout.event.busker-on-the-corner.c.request',
        outcomes: [
          { id: '1', weight: 50, textKey: 'hideout.event.busker-on-the-corner.o.request.1', reward: { cred: 4 } },
          { id: '2', weight: 50, textKey: 'hideout.event.busker-on-the-corner.o.request.2' },
        ],
      },
      {
        id: 'join', labelKey: 'hideout.event.busker-on-the-corner.c.join',
        outcomes: [
          { id: '1', weight: 60, textKey: 'hideout.event.busker-on-the-corner.o.join.1', reward: { cred: 6 } },
          { id: '2', weight: 40, textKey: 'hideout.event.busker-on-the-corner.o.join.2' },
        ],
      },
    ],
  },
  {
    id: 'rooftop-flare', pools: ['rooftop', 'idle'], weight: 5, cooldownMs: 20 * HOUR,
    titleKey: 'hideout.event.rooftop-flare.title', bodyKey: 'hideout.event.rooftop-flare.body',
    when: { timeOfDay: ['dusk', 'night'] },
    choices: [
      {
        id: 'follow', labelKey: 'hideout.event.rooftop-flare.c.follow',
        outcomes: [
          { id: '1', weight: 60, textKey: 'hideout.event.rooftop-flare.o.follow.1', reward: { cred: 6 } },
          { id: '2', weight: 37, textKey: 'hideout.event.rooftop-flare.o.follow.2' },
          { id: '3', weight: 3, textKey: 'hideout.event.rooftop-flare.o.follow.3', rare: true, reward: { petElixirs: 1 }, fallback: { cred: 6 } },
        ],
      },
      {
        id: 'log', labelKey: 'hideout.event.rooftop-flare.c.log',
        outcomes: [
          { id: '1', weight: 100, textKey: 'hideout.event.rooftop-flare.o.log.1', reward: { cred: 3 } },
        ],
      },
      {
        id: 'wave', labelKey: 'hideout.event.rooftop-flare.c.wave',
        outcomes: [
          { id: '1', weight: 50, textKey: 'hideout.event.rooftop-flare.o.wave.1', reward: { cred: 5 } },
          { id: '2', weight: 50, textKey: 'hideout.event.rooftop-flare.o.wave.2' },
        ],
      },
    ],
  },
  {
    id: 'pigeon-census', pools: ['rooftop'], weight: 4, cooldownMs: 10 * HOUR,
    titleKey: 'hideout.event.pigeon-census.title', bodyKey: 'hideout.event.pigeon-census.body',
    when: { timeOfDay: ['dawn', 'day'] },
    choices: [
      {
        id: 'count', labelKey: 'hideout.event.pigeon-census.c.count',
        outcomes: [
          { id: '1', weight: 100, textKey: 'hideout.event.pigeon-census.o.count.1', reward: { cred: 3 } },
        ],
      },
      {
        id: 'salute', labelKey: 'hideout.event.pigeon-census.c.salute',
        outcomes: [
          { id: '1', weight: 60, textKey: 'hideout.event.pigeon-census.o.salute.1', reward: { cred: 4 } },
          { id: '2', weight: 40, textKey: 'hideout.event.pigeon-census.o.salute.2' },
        ],
      },
    ],
  },
  {
    id: 'leaking-pipe', pools: ['cellar'], weight: 4, cooldownMs: 8 * HOUR,
    titleKey: 'hideout.event.leaking-pipe.title', bodyKey: 'hideout.event.leaking-pipe.body',
    when: {  },
    choices: [
      {
        id: 'patch', labelKey: 'hideout.event.leaking-pipe.c.patch',
        outcomes: [
          { id: '1', weight: 70, textKey: 'hideout.event.leaking-pipe.o.patch.1', reward: { cred: 6 } },
          { id: '2', weight: 30, textKey: 'hideout.event.leaking-pipe.o.patch.2' },
        ],
      },
      {
        id: 'collect', labelKey: 'hideout.event.leaking-pipe.c.collect',
        outcomes: [
          { id: '1', weight: 85, textKey: 'hideout.event.leaking-pipe.o.collect.1', reward: { cred: 5 } },
          { id: '2', weight: 15, textKey: 'hideout.event.leaking-pipe.o.collect.2', reward: { cardCredits: 1 } },
        ],
      },
      {
        id: 'leave', labelKey: 'hideout.event.leaking-pipe.c.leave',
        outcomes: [
          { id: '1', weight: 100, textKey: 'hideout.event.leaking-pipe.o.leave.1' },
        ],
      },
    ],
  },
  {
    id: 'lost-leash', pools: ['travel'], weight: 4, cooldownMs: 8 * HOUR,
    titleKey: 'hideout.event.lost-leash.title', bodyKey: 'hideout.event.lost-leash.body',
    when: {  },
    choices: [
      {
        id: 'return', labelKey: 'hideout.event.lost-leash.c.return',
        outcomes: [
          { id: '1', weight: 70, textKey: 'hideout.event.lost-leash.o.return.1', reward: { cred: 10 } },
          { id: '2', weight: 30, textKey: 'hideout.event.lost-leash.o.return.2' },
        ],
      },
      {
        id: 'keep', labelKey: 'hideout.event.lost-leash.c.keep',
        outcomes: [
          { id: '1', weight: 100, textKey: 'hideout.event.lost-leash.o.keep.1' },
        ],
      },
      {
        id: 'ask', labelKey: 'hideout.event.lost-leash.c.ask', requires: { needsPet: true },
        outcomes: [
          { id: '1', weight: 100, textKey: 'hideout.event.lost-leash.o.ask.1', reward: { petExp: 10, bond: true } },
        ],
      },
    ],
  },
  {
    id: 'pet-dream', pools: ['idle'], weight: 6, cooldownMs: 72 * HOUR,
    titleKey: 'hideout.event.pet-dream.title', bodyKey: 'hideout.event.pet-dream.body',
    when: { timeOfDay: ['night'], minBond: 'friend', needsPet: true },
    choices: [
      {
        id: 'wake', labelKey: 'hideout.event.pet-dream.c.wake',
        outcomes: [
          { id: '1', weight: 100, textKey: 'hideout.event.pet-dream.o.wake.1', reward: { petExp: 6, bond: true } },
        ],
      },
      {
        id: 'dream', labelKey: 'hideout.event.pet-dream.c.dream',
        outcomes: [
          { id: '1', weight: 100, textKey: 'hideout.event.pet-dream.o.dream.1', reward: { petExp: 10 } },
        ],
      },
      {
        id: 'sit', labelKey: 'hideout.event.pet-dream.c.sit', requires: { needsPet: true, minBond: 'soulbound' },
        outcomes: [
          { id: '1', weight: 95, textKey: 'hideout.event.pet-dream.o.sit.1', reward: { petExp: 12, bond: true } },
          { id: '2', weight: 5, textKey: 'hideout.event.pet-dream.o.sit.2', rare: true, reward: { petElixirs: 1 }, fallback: { petExp: 12, bond: true } },
        ],
      },
    ],
  },
  {
    id: 'long-way-round', pools: ['walk'], weight: 5, cooldownMs: 6 * HOUR,
    titleKey: 'hideout.event.long-way-round.title', bodyKey: 'hideout.event.long-way-round.body',
    when: {  },
    choices: [
      {
        id: 'long', labelKey: 'hideout.event.long-way-round.c.long',
        outcomes: [
          { id: '1', weight: 60, textKey: 'hideout.event.long-way-round.o.long.1', reward: { cred: 4 } },
          { id: '2', weight: 40, textKey: 'hideout.event.long-way-round.o.long.2' },
        ],
      },
      {
        id: 'short', labelKey: 'hideout.event.long-way-round.c.short',
        outcomes: [
          { id: '1', weight: 70, textKey: 'hideout.event.long-way-round.o.short.1' },
          { id: '2', weight: 30, textKey: 'hideout.event.long-way-round.o.short.2' },
        ],
      },
      {
        id: 'follow', labelKey: 'hideout.event.long-way-round.c.follow', requires: { needsPet: true },
        outcomes: [
          { id: '1', weight: 70, textKey: 'hideout.event.long-way-round.o.follow.1', reward: { petExp: 6, bond: true } },
          { id: '2', weight: 30, textKey: 'hideout.event.long-way-round.o.follow.2', reward: { cred: 3 } },
        ],
      },
    ],
  },
  {
    id: 'roof-leak', pools: ['idle', 'rooftop'], weight: 4, cooldownMs: 8 * HOUR,
    titleKey: 'hideout.event.roof-leak.title', bodyKey: 'hideout.event.roof-leak.body',
    when: { weather: ['rain'] },
    choices: [
      {
        id: 'bucket', labelKey: 'hideout.event.roof-leak.c.bucket',
        outcomes: [
          { id: '1', weight: 70, textKey: 'hideout.event.roof-leak.o.bucket.1', reward: { cred: 6 } },
          { id: '2', weight: 30, textKey: 'hideout.event.roof-leak.o.bucket.2' },
        ],
      },
      {
        id: 'patch', labelKey: 'hideout.event.roof-leak.c.patch',
        outcomes: [
          { id: '1', weight: 60, textKey: 'hideout.event.roof-leak.o.patch.1', reward: { cred: 8 } },
          { id: '2', weight: 40, textKey: 'hideout.event.roof-leak.o.patch.2' },
        ],
      },
      {
        id: 'drip', labelKey: 'hideout.event.roof-leak.c.drip',
        outcomes: [
          { id: '1', weight: 100, textKey: 'hideout.event.roof-leak.o.drip.1' },
        ],
      },
    ],
  },
  {
    id: 'fog-horn', pools: ['rooftop', 'idle'], weight: 4, cooldownMs: 10 * HOUR,
    titleKey: 'hideout.event.fog-horn.title', bodyKey: 'hideout.event.fog-horn.body',
    when: { weather: ['fog'] },
    choices: [
      {
        id: 'answer', labelKey: 'hideout.event.fog-horn.c.answer',
        outcomes: [
          { id: '1', weight: 70, textKey: 'hideout.event.fog-horn.o.answer.1', reward: { cred: 6 } },
          { id: '2', weight: 22, textKey: 'hideout.event.fog-horn.o.answer.2' },
          { id: '3', weight: 8, textKey: 'hideout.event.fog-horn.o.answer.3', reward: { cardCredits: 1 } },
        ],
      },
      {
        id: 'quiet', labelKey: 'hideout.event.fog-horn.c.quiet',
        outcomes: [
          { id: '1', weight: 100, textKey: 'hideout.event.fog-horn.o.quiet.1' },
        ],
      },
    ],
  },
  {
    id: 'fog-wander', pools: ['idle', 'walk'], weight: 4, cooldownMs: 10 * HOUR,
    titleKey: 'hideout.event.fog-wander.title', bodyKey: 'hideout.event.fog-wander.body',
    when: { weather: ['fog'], needsPet: true },
    choices: [
      {
        id: 'call', labelKey: 'hideout.event.fog-wander.c.call', requires: { needsPet: true },
        outcomes: [
          { id: '1', weight: 60, textKey: 'hideout.event.fog-wander.o.call.1', reward: { petExp: 6, bond: true } },
          { id: '2', weight: 40, textKey: 'hideout.event.fog-wander.o.call.2', reward: { cred: 5 } },
        ],
      },
      {
        id: 'wait', labelKey: 'hideout.event.fog-wander.c.wait', requires: { needsPet: true },
        outcomes: [
          { id: '1', weight: 55, textKey: 'hideout.event.fog-wander.o.wait.1', reward: { petExp: 4 } },
          { id: '2', weight: 45, textKey: 'hideout.event.fog-wander.o.wait.2' },
        ],
      },
    ],
  },
  {
    id: 'crew-card-night', pools: ['idle'], weight: 5, cooldownMs: 12 * HOUR,
    titleKey: 'hideout.event.crew-card-night.title', bodyKey: 'hideout.event.crew-card-night.body',
    when: { timeOfDay: ['night'] },
    choices: [
      {
        id: 'deal', labelKey: 'hideout.event.crew-card-night.c.deal',
        outcomes: [
          { id: '1', weight: 55, textKey: 'hideout.event.crew-card-night.o.deal.1', reward: { cred: 7 } },
          { id: '2', weight: 45, textKey: 'hideout.event.crew-card-night.o.deal.2', reward: { cred: 3 } },
        ],
      },
      {
        id: 'watch', labelKey: 'hideout.event.crew-card-night.c.watch',
        outcomes: [
          { id: '1', weight: 100, textKey: 'hideout.event.crew-card-night.o.watch.1' },
        ],
      },
      {
        id: 'tidy', labelKey: 'hideout.event.crew-card-night.c.tidy',
        outcomes: [
          { id: '1', weight: 60, textKey: 'hideout.event.crew-card-night.o.tidy.1', reward: { cred: 5 } },
          { id: '2', weight: 40, textKey: 'hideout.event.crew-card-night.o.tidy.2' },
        ],
      },
    ],
  },
  {
    id: 'warm-glass', pools: ['cellar'], weight: 4, cooldownMs: 8 * HOUR,
    titleKey: 'hideout.event.warm-glass.title', bodyKey: 'hideout.event.warm-glass.body',
    when: { weather: ['heat'] },
    choices: [
      {
        id: 'polish', labelKey: 'hideout.event.warm-glass.c.polish',
        outcomes: [
          { id: '1', weight: 65, textKey: 'hideout.event.warm-glass.o.polish.1', reward: { cred: 6 } },
          { id: '2', weight: 35, textKey: 'hideout.event.warm-glass.o.polish.2', reward: { cred: 3 } },
        ],
      },
      {
        id: 'listen', labelKey: 'hideout.event.warm-glass.c.listen',
        outcomes: [
          { id: '1', weight: 70, textKey: 'hideout.event.warm-glass.o.listen.1', reward: { cred: 2 } },
          { id: '2', weight: 30, textKey: 'hideout.event.warm-glass.o.listen.2' },
        ],
      },
    ],
  },
];

export const CHOICE_EVENTS_BY_ID: Record<string, ChoiceEventDef> = Object.fromEntries(CHOICE_EVENTS.map((event) => [event.id, event]));

export const CHOICE_TRIGGERS: ChoiceTrigger[] = [
  { id: 'storefront-door', source: 'hub-room', roomId: 'the-storefront', chance: 0.12, pool: 'travel' },
  { id: 'grpd-door', source: 'hub-room', roomId: 'grpd-station', chance: 0.12, pool: 'travel' },
  { id: 'alley-door', source: 'hub-room', roomId: 'the-alley', chance: 0.1, pool: 'alley' },
  { id: 'cellar-door', source: 'hub-room', roomId: 'the-cellar', chance: 0.1, pool: 'cellar' },
  { id: 'head-out-pause', source: 'run-launch', chance: 0.08, pool: 'travel' },
  { id: 'long-way-round', source: 'strip-walk', chance: 0.3, pool: 'walk' },
  { id: 'idle-moment', source: 'idle', chance: 1, pool: 'idle' },
];

/** Claim key used for a choice event in `hideoutClaims`. */
export const choiceClaimKey = (id: string): string => `event.${id}`;
