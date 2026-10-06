import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createRng } from '@/game/engine/math';
import { rollLokPet } from '@/game/data/lokPets';
import { HUB_ROOMS } from '@/game/data/progression';
import { HIDEOUT_PROPS } from '@/game/data/hideoutProps';
import {
  CHOICE_EVENTS,
  CHOICE_EVENTS_BY_ID,
  CHOICE_TRIGGERS,
  choiceClaimKey,
} from '@/game/data/choiceEvents';
import {
  applyChoice,
  choiceBlock,
  choiceEventAvailable,
  choiceHistory,
  eventPetFor,
  pickChoiceEvent,
  rollChoiceOutcome,
} from '@/game/engine/choiceEvents';
import { BOND_RANKS } from '@/game/engine/petGrowth';
import { DAILY_CAP, EVENTS_DAILY_MAX, PER_GRANT_MAX, RARE_DAILY_MAX, type SmallReward } from '@/game/engine/hideoutRewards';
import { ELIXIR_CAP, createInitialMeta, reducer } from '@/game/state/metaStore';
import type { SavedLokPet } from '@/game/types';

const BANNED = new RegExp(['sig', 'nal'].join(''), 'i');
const EN = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'locales', 'en.json'), 'utf8')) as Record<string, string>;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NIGHT = new Date(2026, 9, 6, 22, 0, 0).getTime();
const NOON = new Date(2026, 9, 6, 12, 0, 0).getTime();
const PET_RE = /\{\{\s*pet\s*\}\}/;

function pet(over: Partial<SavedLokPet> = {}): SavedLokPet {
  return { id: 'p1', roll: rollLokPet(createRng(7), { fixedVariantId: 'gyro-sentry' }), stamina: 3, level: 1, exp: 0, battlesWon: 0, battlesFought: 0, ...over };
}
const start = (pets: SavedLokPet[] = [pet({ bond: 60 })]) => ({ meta: { ...createInitialMeta(), savedLokPets: pets, cred: 0 }, lastRun: null, lastCardPackReveal: null });
const choose = (state: ReturnType<typeof start>, eventId: string, choiceId: string, now: number, seed = 3, extra: { petId?: string; propId?: string } = { petId: 'p1' }) =>
  reducer(state, { type: 'resolveChoiceEvent', eventId, choiceId, seed, now, ...extra });

function rewards(event: (typeof CHOICE_EVENTS)[number]): SmallReward[] {
  return event.choices.flatMap((c) => c.outcomes.flatMap((o) => [o.reward, o.fallback].filter((r): r is SmallReward => Boolean(r))));
}

describe('choice event data', () => {
  it('has unique ids, real pools and known bond ranks', () => {
    assert.equal(new Set(CHOICE_EVENTS.map((e) => e.id)).size, CHOICE_EVENTS.length);
    const ranks = new Set(BOND_RANKS.map((r) => r.id));
    const triggerPools = new Set(CHOICE_TRIGGERS.map((trigger) => trigger.pool));
    const propPools = new Set(HIDEOUT_PROPS.flatMap((prop) => (prop.action.kind === 'event' ? [prop.action.pool] : [])));
    for (const event of CHOICE_EVENTS) {
      assert.ok(event.weight > 0 && event.cooldownMs >= HOUR, event.id);
      assert.ok(event.choices.length >= 2 && event.choices.length <= 3, event.id);
      assert.ok(event.pools.length > 0, event.id);
      for (const pool of event.pools) assert.ok(triggerPools.has(pool) || propPools.has(pool), `${event.id}: nothing offers pool ${pool}`);
      if (event.when.minBond) assert.ok(ranks.has(event.when.minBond), event.id);
      for (const choice of event.choices) if (choice.requires?.minBond) assert.ok(ranks.has(choice.requires.minBond), event.id);
    }
    assert.ok(CHOICE_EVENTS.length >= 8);
  });

  it('only uses text that exists in en.json and avoids the banned word', () => {
    for (const event of CHOICE_EVENTS) {
      const keys = [event.titleKey, event.bodyKey, ...event.choices.flatMap((c) => [c.labelKey, ...c.outcomes.map((o) => o.textKey)])];
      for (const key of keys) {
        assert.ok(EN[key], `${event.id}: missing ${key}`);
        assert.ok(!BANNED.test(EN[key]!), key);
      }
    }
    assert.ok(!BANNED.test(JSON.stringify(CHOICE_EVENTS)));
  });

  it('only mentions the pet where there is a pet to mention', () => {
    for (const event of CHOICE_EVENTS) {
      const eventNeedsPet = event.when.needsPet === true;
      if (!eventNeedsPet) {
        assert.ok(!PET_RE.test(EN[event.titleKey]!) && !PET_RE.test(EN[event.bodyKey]!), `${event.id}: title/body mention the pet`);
      }
      for (const choice of event.choices) {
        const choiceNeedsPet = eventNeedsPet || choice.requires?.needsPet === true;
        const texts = [EN[choice.labelKey]!, ...choice.outcomes.map((o) => EN[o.textKey]!)];
        if (!choiceNeedsPet) for (const text of texts) assert.ok(!PET_RE.test(text), `${event.id}/${choice.id}: mentions the pet without needing one`);
        // Rewards that go to the pet need a pet too.
        const petReward = choice.outcomes.some((o) => (o.reward?.petExp ?? 0) > 0 || o.reward?.bond);
        if (petReward) assert.ok(choiceNeedsPet, `${event.id}/${choice.id}: pays the pet without needing one`);
      }
    }
  });

  it('keeps every reward small, and rare outcomes rare, flagged and backed by a fallback', () => {
    for (const event of CHOICE_EVENTS) {
      for (const reward of rewards(event)) {
        for (const key of ['cred', 'cardCredits', 'lokPetTreats', 'petElixirs', 'skeletonKeys', 'petExp'] as const) {
          assert.ok((reward[key] ?? 0) <= PER_GRANT_MAX[key], `${event.id}.${key}`);
        }
        assert.equal(reward.skeletonKeys ?? 0, 0, event.id);
      }
      for (const choice of event.choices) {
        const total = choice.outcomes.reduce((sum, o) => sum + o.weight, 0);
        assert.ok(choice.outcomes.every((o) => o.weight > 0), `${event.id}/${choice.id}`);
        const rareShare = choice.outcomes.filter((o) => o.rare).reduce((sum, o) => sum + o.weight, 0) / total;
        assert.ok(rareShare <= 0.05, `${event.id}/${choice.id}: rare share ${rareShare}`);
        for (const outcome of choice.outcomes) {
          const scarce = ['cardCredits', 'lokPetTreats', 'petElixirs'].some((key) => ((outcome.reward as Record<string, number> | undefined)?.[key] ?? 0) > 0);
          if (scarce && outcome.weight / total > 0.2) assert.fail(`${event.id}/${choice.id}: scarce item is not rare enough`);
          if (outcome.rare) assert.ok(outcome.fallback, `${event.id}/${choice.id}: rare outcome needs a fallback`);
        }
      }
    }
    assert.ok(CHOICE_EVENTS.filter((e) => e.choices.some((c) => c.outcomes.some((o) => o.rare))).length >= 3);
  });

  it('has triggers that point at real rooms and sane odds', () => {
    const rooms = new Set(HUB_ROOMS.map((room) => room.id));
    assert.equal(new Set(CHOICE_TRIGGERS.map((t) => t.id)).size, CHOICE_TRIGGERS.length);
    for (const trigger of CHOICE_TRIGGERS) {
      assert.ok(trigger.chance > 0 && trigger.chance <= 1, trigger.id);
      if (trigger.source === 'hub-room') assert.ok(trigger.roomId && rooms.has(trigger.roomId), trigger.id);
      assert.ok(CHOICE_EVENTS.some((event) => event.pools.includes(trigger.pool)), `${trigger.id}: empty pool ${trigger.pool}`);
    }
    assert.ok(CHOICE_TRIGGERS.some((t) => t.source === 'strip-walk') && CHOICE_TRIGGERS.some((t) => t.source === 'run-launch'));
  });

  it('gives every prop that starts an event a pool that has something for the day and for the night', () => {
    const lonely = pet();
    for (const prop of HIDEOUT_PROPS) {
      if (prop.action.kind !== 'event') continue;
      for (const now of [NOON, NIGHT]) {
        const rng = createRng(1);
        assert.ok(pickChoiceEvent(prop.action.pool, {}, { now }, rng) || pickChoiceEvent(prop.action.pool, {}, { now, pet: lonely }, rng), `${prop.id} at ${new Date(now).getHours()}h`);
      }
    }
  });
});

describe('choice event rules', () => {
  it('picks only events that fit the pool, the time and the pet, and respects cooldowns', () => {
    const rng = createRng(4);
    for (let i = 0; i < 40; i += 1) {
      const picked = pickChoiceEvent('travel', {}, { now: NOON }, rng);
      assert.ok(picked && picked.pools.includes('travel') && !picked.when.needsPet);
    }
    assert.equal(pickChoiceEvent('idle', {}, { now: NOON }, rng), CHOICE_EVENTS_BY_ID['dropped-satchel']);
    const dream = CHOICE_EVENTS_BY_ID['pet-dream']!;
    assert.equal(choiceEventAvailable(dream, {}, { now: NIGHT }), false);
    assert.equal(choiceEventAvailable(dream, {}, { now: NIGHT, pet: pet({ bond: 60 }) }), true);
    assert.equal(choiceEventAvailable(dream, {}, { now: NIGHT, pet: pet({ bond: 0 }) }), false);
    assert.equal(choiceEventAvailable(dream, {}, { now: NOON, pet: pet({ bond: 60 }) }), false);
    const claims = { [choiceClaimKey(dream.id)]: NIGHT };
    assert.equal(choiceEventAvailable(dream, claims, { now: NIGHT + HOUR, pet: pet({ bond: 60 }) }), false);
    assert.equal(choiceEventAvailable(dream, claims, { now: NIGHT + 4 * DAY, pet: pet({ bond: 60 }) }), true);
    assert.deepEqual(choiceHistory({ 'event.a': 5, 'prop.b': 6, 'rare.cred': 7 }), { a: 5 });
  });

  it('closes options that need a pet or a bond rank', () => {
    const sit = CHOICE_EVENTS_BY_ID['pet-dream']!.choices.find((c) => c.id === 'sit')!;
    assert.equal(choiceBlock(sit, undefined), 'pet');
    assert.equal(choiceBlock(sit, pet({ bond: 60 })), 'bond');
    assert.equal(choiceBlock(sit, pet({ bond: 300 })), null);
    const feed = CHOICE_EVENTS_BY_ID['stray-at-the-door']!.choices.find((c) => c.id === 'feed')!;
    assert.equal(choiceBlock(feed, undefined), null);
  });

  it('rolls the same outcome for the same seed', () => {
    const choice = CHOICE_EVENTS_BY_ID['dropped-satchel']!.choices[0]!;
    for (let seed = 0; seed < 80; seed += 1) assert.equal(rollChoiceOutcome(choice, createRng(seed)).id, rollChoiceOutcome(choice, createRng(seed)).id);
    const ids = new Set(Array.from({ length: 400 }, (_, seed) => rollChoiceOutcome(choice, createRng(seed)).id));
    assert.ok(ids.size >= 2);
  });

  it('picks a pet for the scene: the starter, else the loadout, else any', () => {
    const starter = pet({ id: 's', starter: true });
    const other = pet({ id: 'o' });
    assert.equal(eventPetFor({ savedLokPets: [other, starter] })?.id, 's');
    assert.equal(eventPetFor({ savedLokPets: [other, pet({ id: 'z' })], selectedLokPetIds: ['z'] })?.id, 'z');
    assert.equal(eventPetFor({ savedLokPets: [other] })?.id, 'o');
    assert.equal(eventPetFor({ savedLokPets: [] }), undefined);
  });
});

describe('resolving a choice event', () => {
  it('pays through the policy, stamps the claim, and treats a replay as a no-op', () => {
    const first = choose(start(), 'dropped-satchel', 'hand-in', NOON);
    assert.equal(first.meta.cred, 5);
    assert.ok(first.meta.hideoutClaims[choiceClaimKey('dropped-satchel')]);
    assert.equal(first.meta.hideoutLedger.events, 1);
    assert.equal(choose(first, 'dropped-satchel', 'hand-in', NOON + 1000), first);
  });

  it('is a no-op for unknown events and choices, and for options that are closed', () => {
    const s = start([pet({ bond: 0 })]);
    assert.equal(choose(s, 'nope', 'x', NOON), s);
    assert.equal(choose(s, 'dropped-satchel', 'nope', NOON), s);
    assert.equal(choose(s, 'stray-at-the-door', 'pet', NIGHT), s);
    assert.equal(choose(s, 'dropped-satchel', 'sniff', NOON, 3, {}), s);
  });

  it('stops after the daily event limit and resets the next day', () => {
    let s = start();
    const ids = CHOICE_EVENTS.filter((e) => !e.when.needsPet).map((e) => e.id);
    for (let i = 0; i < ids.length; i += 1) s = choose(s, ids[i]!, CHOICE_EVENTS_BY_ID[ids[i]!]!.choices[0]!.id, NOON + i * 1000, 5 + i);
    assert.equal(s.meta.hideoutLedger.events, EVENTS_DAILY_MAX);
    const next = choose(s, ids[ids.length - 1]!, CHOICE_EVENTS_BY_ID[ids[ids.length - 1]!]!.choices[0]!.id, NOON + DAY + 5000, 9);
    assert.equal(next.meta.hideoutLedger.events, 1);
  });

  it('spends the offering prop for the day and refuses a prop that is not an event prop', () => {
    const s = start();
    const ok = choose(s, 'dropped-satchel', 'hand-in', NOON, 3, { petId: 'p1', propId: 'stoop-cat' });
    assert.ok(ok.meta.hideoutClaims['prop.stoop-cat']);
    assert.equal(choose(s, 'dropped-satchel', 'hand-in', NOON, 3, { petId: 'p1', propId: 'bell-cord' }), s);
    assert.equal(choose(ok, 'stray-at-the-door', 'shoo', NOON + 2000, 3, { petId: 'p1', propId: 'stoop-cat' }), ok);
  });

  it('grows the pet for pet outcomes', () => {
    const s = choose(start([pet({ bond: 60 })]), 'lost-leash', 'ask', NOON);
    const grown = s.meta.savedLokPets[0]!;
    assert.ok((grown.exp ?? 0) > 0 || (grown.level ?? 1) > 1);
    assert.equal(grown.bond, 61);
  });

  it('previews exactly what it pays', () => {
    const state = start();
    for (let seed = 0; seed < 25; seed += 1) {
      const preview = applyChoice(state.meta, 'dropped-satchel', 'open', seed, { now: NOON, petId: 'p1', elixirCap: ELIXIR_CAP });
      const real = choose(state, 'dropped-satchel', 'open', NOON, seed);
      assert.equal(preview.ok, true);
      assert.equal(real.meta.cred, preview.meta.cred);
      assert.equal(real.meta.cardCredits, preview.meta.cardCredits);
    }
  });

  it('keeps the whole hideout inside its caps however many events are driven across days', () => {
    const rng = createRng(77);
    let s = start([pet({ bond: 300 })]);
    for (let day = 0; day < 30; day += 1) {
      const dayStart = NOON + day * DAY;
      const before = { ...s.meta };
      for (let i = 0; i < 12; i += 1) {
        const event = CHOICE_EVENTS[Math.floor(rng() * CHOICE_EVENTS.length)]!;
        const choice = event.choices[Math.floor(rng() * event.choices.length)]!;
        s = choose(s, event.id, choice.id, dayStart + i * 6 * HOUR / 12 + (day % 2) * 7 * HOUR, Math.floor(rng() * 1e9));
      }
      const gained = {
        cred: s.meta.cred - before.cred,
        cardCredits: s.meta.cardCredits - before.cardCredits,
        lokPetTreats: s.meta.lokPetTreats - before.lokPetTreats,
        petElixirs: s.meta.petElixirs - before.petElixirs,
      };
      assert.ok(gained.cred <= DAILY_CAP.cred + PER_GRANT_MAX.cred, `day ${day} cred ${gained.cred}`);
      assert.ok(gained.cardCredits <= DAILY_CAP.cardCredits + PER_GRANT_MAX.cardCredits, `day ${day}`);
      assert.ok(gained.lokPetTreats <= DAILY_CAP.lokPetTreats + PER_GRANT_MAX.lokPetTreats, `day ${day}`);
      assert.ok(gained.petElixirs <= DAILY_CAP.petElixirs + PER_GRANT_MAX.petElixirs, `day ${day}`);
    }
    assert.ok(s.meta.hideoutLedger.rare <= RARE_DAILY_MAX);
  });
});
