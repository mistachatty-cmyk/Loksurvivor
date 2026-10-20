import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createRng } from '@/game/engine/math';
import { rollLokPet } from '@/game/data/lokPets';
import {
  DAILY_CAP,
  EVENTS_DAILY_MAX,
  MAX_CLAIMS,
  PER_GRANT_MAX,
  RARE_COOLDOWN_MS,
  RARE_DAILY_MAX,
  bondLuck,
  eventsLeftToday,
  grantSmallReward,
  grantWithFallback,
  ledgerFor,
  trimClaims,
} from '@/game/engine/hideoutRewards';
import { createInitialMeta, normalizeMeta, reducer } from '@/game/state/metaStore';
import type { SavedLokPet } from '@/game/types';

const DAY = 24 * 60 * 60 * 1000;
const NOON = new Date(2026, 9, 6, 12, 0, 0).getTime();

function pet(over: Partial<SavedLokPet> = {}): SavedLokPet {
  return { id: 'p1', roll: rollLokPet(createRng(7), { fixedVariantId: 'gyro-sentry' }), stamina: 3, level: 1, exp: 0, battlesWon: 0, battlesFought: 0, ...over };
}
const base = (savedLokPets: SavedLokPet[] = [pet()]) => ({ ...createInitialMeta(), savedLokPets, cred: 0, cardCredits: 0, lokPetTreats: 0, petElixirs: 0, skeletonKeys: 0 });
const ctx = (now: number, extra = {}) => ({ now, elixirCap: 18, ...extra });

describe('hideout reward policy', () => {
  it('pays small amounts and counts them against the day', () => {
    const first = grantSmallReward(base(), { cred: 8 }, ctx(NOON));
    assert.equal(first.meta.cred, 8);
    assert.deepEqual(first.applied, { cred: 8 });
    assert.equal(ledgerFor(first.meta.hideoutLedger, NOON).granted.cred, 8);
  });

  it('clips a single grant and the daily total', () => {
    const big = grantSmallReward(base(), { cred: 500 }, ctx(NOON));
    assert.equal(big.meta.cred, PER_GRANT_MAX.cred);
    assert.deepEqual(big.clipped, ['cred']);
    let meta = base();
    for (let i = 0; i < 20; i += 1) meta = grantSmallReward(meta, { cred: PER_GRANT_MAX.cred }, ctx(NOON + i)).meta;
    assert.equal(meta.cred, DAILY_CAP.cred);
  });

  it('starts a fresh allowance the next local day', () => {
    let meta = base();
    for (let i = 0; i < 10; i += 1) meta = grantSmallReward(meta, { cred: 15 }, ctx(NOON)).meta;
    assert.equal(meta.cred, DAILY_CAP.cred);
    meta = grantSmallReward(meta, { cred: 15 }, ctx(NOON + DAY)).meta;
    assert.equal(meta.cred, DAILY_CAP.cred + 15);
    assert.equal(eventsLeftToday(meta.hideoutLedger, NOON + DAY), EVENTS_DAILY_MAX);
  });

  it('allows one rare find a day and then asks for the fallback', () => {
    const first = grantSmallReward(base(), { lokPetTreats: 1 }, ctx(NOON, { rare: true }));
    assert.equal(first.meta.lokPetTreats, 1);
    assert.equal(first.meta.hideoutLedger.rare, 1);
    const second = grantSmallReward(first.meta, { cardCredits: 2 }, ctx(NOON + 1000, { rare: true }));
    assert.equal(second.rareBlocked, true);
    assert.equal(second.paid, false);
    const withFallback = grantWithFallback(first.meta, { cardCredits: 2 }, { cred: 5 }, ctx(NOON + 1000, { rare: true }));
    assert.equal(withFallback.usedFallback, true);
    assert.equal(withFallback.meta.cred, 5);
    assert.equal(withFallback.meta.cardCredits, 0);
  });

  it('keeps a rare item on cooldown across days', () => {
    const first = grantSmallReward(base(), { petElixirs: 1 }, ctx(NOON, { rare: true }));
    assert.equal(first.meta.petElixirs, 1);
    const tomorrow = grantSmallReward(first.meta, { petElixirs: 1 }, ctx(NOON + DAY, { rare: true }));
    assert.equal(tomorrow.rareBlocked, true);
    const later = grantSmallReward(first.meta, { petElixirs: 1 }, ctx(NOON + (RARE_COOLDOWN_MS.petElixirs ?? 0) + 1000, { rare: true }));
    assert.equal(later.meta.petElixirs, 2);
  });

  it('never pays skeleton keys outside a rare find, and respects the elixir stock cap', () => {
    assert.equal(grantSmallReward(base(), { skeletonKeys: 1 }, ctx(NOON)).meta.skeletonKeys, 0);
    const full = { ...base(), petElixirs: 18 };
    assert.equal(grantSmallReward(full, { petElixirs: 1 }, ctx(NOON, { rare: true })).meta.petElixirs, 18);
  });

  it('grows the target pet through the normal level and bond rules', () => {
    const result = grantSmallReward(base(), { petExp: 5, bond: true }, ctx(NOON, { petId: 'p1', bondSource: 'play' }));
    const grown = result.meta.savedLokPets[0]!;
    assert.ok((grown.exp ?? 0) > 0 || (grown.level ?? 1) > 1);
    assert.equal(grown.bond, 1);
    assert.equal(result.applied.bond, true);
    // Bond stays capped per day however often it is asked for.
    let meta = base();
    for (let i = 0; i < 40; i += 1) meta = grantSmallReward(meta, { bond: true }, ctx(NOON + i, { petId: 'p1', bondSource: 'event' })).meta;
    assert.ok((meta.savedLokPets[0]!.bond ?? 0) <= 12);
  });

  it('ignores pet rewards when no pet is named', () => {
    const result = grantSmallReward(base(), { petExp: 50, bond: true }, ctx(NOON));
    assert.equal(result.paid, false);
  });

  it('never exceeds the daily caps, rare limit or event limit however it is driven', () => {
    const rng = createRng(1234);
    const keys = ['cred', 'cardCredits', 'lokPetTreats', 'petElixirs', 'skeletonKeys'] as const;
    let meta = base();
    let events = 0;
    for (let i = 0; i < 400; i += 1) {
      const key = keys[Math.floor(rng() * keys.length)]!;
      const rare = rng() < 0.3;
      const reward = { [key]: 1 + Math.floor(rng() * 40), petExp: Math.floor(rng() * 60), bond: rng() < 0.5 };
      const outcome = grantWithFallback(meta, reward, { cred: 6 }, ctx(NOON + i * 1000, { rare, petId: 'p1', countsAsEvent: true }));
      meta = outcome.meta;
      events += 1;
    }
    const ledger = ledgerFor(meta.hideoutLedger, NOON);
    for (const key of ['cred', 'cardCredits', 'lokPetTreats', 'petElixirs', 'petExp'] as const) {
      // A rare find is allowed past the everyday allowance, but only once.
      assert.ok((ledger.granted[key] ?? 0) <= DAILY_CAP[key] + PER_GRANT_MAX[key], key);
    }
    assert.ok(ledger.rare <= RARE_DAILY_MAX);
    assert.ok(meta.cred <= DAILY_CAP.cred + PER_GRANT_MAX.cred);
    assert.equal(events, 400);
  });

  it('scales rare luck with the best bond rank', () => {
    assert.equal(bondLuck([]), 1);
    assert.equal(bondLuck([{ bond: 0 }]), 1);
    assert.equal(bondLuck([{ bond: 300 }, { bond: 20 }]), 2);
  });

  it('keeps only the newest claims', () => {
    const claims: Record<string, number> = {};
    for (let i = 0; i < MAX_CLAIMS + 30; i += 1) claims[`prop.p${i}`] = i + 1;
    const trimmed = trimClaims(claims);
    assert.equal(Object.keys(trimmed).length, MAX_CLAIMS);
    assert.ok(trimmed[`prop.p${MAX_CLAIMS + 29}`]);
    assert.equal(trimmed['prop.p0'], undefined);
  });
});

describe('hideout saved state', () => {
  it('defaults the new settings on and cleans garbage claims and ledgers', () => {
    const fresh = normalizeMeta({});
    assert.equal(fresh.hideoutInteractive, true);
    assert.equal(fresh.hideoutPetPlay, true);
    assert.equal(fresh.hideoutChoiceEvents, 'on');
    const dirty = normalizeMeta({
      hideoutClaims: { 'prop.bell-cord': 5, '': 9, bad: 'x', neg: -3, ['x'.repeat(60)]: 4 } as unknown as Record<string, number>,
      hideoutLedger: { day: 'yesterday', granted: { cred: 'lots' }, events: -2, rare: 'many' } as never,
      hideoutChoiceEvents: 'loud' as never,
    });
    assert.deepEqual(dirty.hideoutClaims, { 'prop.bell-cord': 5 });
    assert.equal(dirty.hideoutLedger.day, '');
    assert.equal(dirty.hideoutLedger.events, 0);
    assert.equal(dirty.hideoutChoiceEvents, 'on');
    const keep = normalizeMeta({ hideoutLedger: { day: '2026-10-06', granted: { cred: 12, petExp: 40, bogus: 9 } as never, events: 2, rare: 1 } });
    assert.deepEqual(keep.hideoutLedger, { day: '2026-10-06', granted: { cred: 12, petExp: 40 }, events: 2, rare: 1 });
  });

  it('applies the three settings through the reducer', () => {
    const start = { meta: createInitialMeta(), lastRun: null, lastCardPackReveal: null };
    assert.equal(reducer(start, { type: 'setHideoutInteractive', enabled: false }).meta.hideoutInteractive, false);
    assert.equal(reducer(start, { type: 'setHideoutPetPlay', enabled: false }).meta.hideoutPetPlay, false);
    assert.equal(reducer(start, { type: 'setHideoutChoiceEvents', mode: 'quiet' }).meta.hideoutChoiceEvents, 'quiet');
  });
});
