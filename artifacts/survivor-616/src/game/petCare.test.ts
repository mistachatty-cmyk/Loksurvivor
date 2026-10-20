import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createRng } from '@/game/engine/math';
import { rollLokPet } from '@/game/data/lokPets';
import { HIDEOUT_EMOTES, HIDEOUT_MOVES, HIDEOUT_TEMPERAMENTS } from '@/game/data/hideoutEvents';
import {
  MOOD_EXP_MULTIPLIER,
  PET_CARE_VERBS,
  PET_CARE_VERBS_BY_ID,
  applyPetCare,
  careClaimKey,
  careCooldownLeftMs,
  careVerbBlock,
  moodFor,
  rollPetCareFind,
} from '@/game/data/petCare';
import { BOND_DAILY_CAP, BOND_RANKS } from '@/game/engine/petGrowth';
import { PER_GRANT_MAX } from '@/game/engine/hideoutRewards';
import { ELIXIR_CAP, createInitialMeta, reducer } from '@/game/state/metaStore';
import type { SavedLokPet } from '@/game/types';

const BANNED = new RegExp(['sig', 'nal'].join(''), 'i');
const EN = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'locales', 'en.json'), 'utf8')) as Record<string, string>;
const HOUR = 60 * 60 * 1000;
const NIGHT = new Date(2026, 9, 6, 22, 0, 0).getTime();
const NOON = new Date(2026, 9, 6, 12, 0, 0).getTime();

function pet(over: Partial<SavedLokPet> = {}): SavedLokPet {
  return { id: 'p1', roll: rollLokPet(createRng(7), { fixedVariantId: 'gyro-sentry' }), stamina: 3, level: 1, exp: 0, battlesWon: 0, battlesFought: 0, ...over };
}
const start = (pets: SavedLokPet[] = [pet()]) => ({ meta: { ...createInitialMeta(), savedLokPets: pets, cred: 0 }, lastRun: null, lastCardPackReveal: null });
const play = (state: ReturnType<typeof start>, verbId: string, now: number, seed = 5, musicPlaying = true) =>
  reducer(state, { type: 'playWithLokPet', petId: 'p1', verbId, seed, now, musicPlaying });

describe('pet care data', () => {
  it('has unique ids, known moves and emotes, and positive numbers', () => {
    assert.equal(new Set(PET_CARE_VERBS.map((v) => v.id)).size, PET_CARE_VERBS.length);
    const ranks = new Set(BOND_RANKS.map((r) => r.id));
    const temperaments = new Set(HIDEOUT_TEMPERAMENTS.map((t) => t.id));
    for (const verb of PET_CARE_VERBS) {
      assert.ok(HIDEOUT_MOVES.includes(verb.move), verb.id);
      assert.ok(HIDEOUT_EMOTES.includes(verb.emote), verb.id);
      assert.ok(verb.durationMs >= 1000 && verb.cooldownMs >= HOUR, verb.id);
      assert.ok(verb.reward.exp > 0 && verb.reward.exp <= 12, verb.id);
      if (verb.minBond) assert.ok(ranks.has(verb.minBond), verb.id);
      for (const id of Object.keys(verb.affinity)) assert.ok(temperaments.has(id as never), verb.id);
      // The claim key has to survive the 40 character id limit in the saved history.
      assert.ok(careClaimKey(verb.id).length <= 40, verb.id);
    }
    assert.ok(PET_CARE_VERBS.length >= 6);
  });

  it('only uses text that exists in en.json, with the pet placeholder, and avoids the banned word', () => {
    for (const verb of PET_CARE_VERBS) {
      const keys = [verb.labelKey, verb.hintKey, ...Object.values(verb.lineKeys), ...(verb.reward.find?.rare ? [verb.reward.find.rare.textKey] : [])];
      for (const key of keys) {
        assert.ok(EN[key], `${verb.id}: missing ${key}`);
        assert.ok(!BANNED.test(EN[key]!), key);
      }
      for (const line of Object.values(verb.lineKeys)) assert.ok(EN[line]!.includes('{{pet}}'), line);
    }
    assert.ok(!BANNED.test(JSON.stringify(PET_CARE_VERBS)));
  });

  it('keeps finds small and rare finds rare, with a fallback', () => {
    for (const verb of PET_CARE_VERBS) {
      const find = verb.reward.find;
      if (!find) continue;
      assert.ok(find.rows.length > 0 && find.rows.every((row) => row.weight > 0), verb.id);
      for (const row of find.rows) for (const key of ['cred', 'lokPetTreats'] as const) assert.ok((row.reward[key] ?? 0) <= PER_GRANT_MAX[key], verb.id);
      if (find.rare) assert.ok(find.rare.baseChance <= 0.05 && find.rare.fallback, verb.id);
    }
  });
});

describe('pet care rules', () => {
  it('scales XP by how much the pet likes the verb', () => {
    const scratch = PET_CARE_VERBS_BY_ID['scratch']!;
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const moods = new Set(ids.map((id) => moodFor(scratch, id)));
    assert.ok(moods.has('loved') || moods.has('meh') || moods.has('liked'));
    assert.ok(MOOD_EXP_MULTIPLIER.loved > MOOD_EXP_MULTIPLIER.liked && MOOD_EXP_MULTIPLIER.liked > MOOD_EXP_MULTIPLIER.meh);
  });

  it('blocks verbs for bond, music and time of day, and counts down a cooldown', () => {
    const p = pet();
    assert.equal(careVerbBlock(PET_CARE_VERBS_BY_ID['sniff-hunt']!, p, { now: NOON, musicPlaying: true }), 'bond');
    assert.equal(careVerbBlock(PET_CARE_VERBS_BY_ID['sniff-hunt']!, { ...p, bond: 20 }, { now: NOON, musicPlaying: true }), null);
    assert.equal(careVerbBlock(PET_CARE_VERBS_BY_ID['boogie']!, p, { now: NOON, musicPlaying: false }), 'music');
    assert.equal(careVerbBlock(PET_CARE_VERBS_BY_ID['boogie']!, p, { now: NOON, musicPlaying: true }), null);
    assert.equal(careVerbBlock(PET_CARE_VERBS_BY_ID['nap-together']!, p, { now: NOON, musicPlaying: true }), 'time');
    assert.equal(careVerbBlock(PET_CARE_VERBS_BY_ID['nap-together']!, p, { now: NIGHT, musicPlaying: true }), null);
    const used = pet({ hideoutEvents: { [careClaimKey('fetch')]: NOON } });
    assert.equal(careVerbBlock(PET_CARE_VERBS_BY_ID['fetch']!, used, { now: NOON + HOUR, musicPlaying: true }), 'cooldown');
    assert.equal(careCooldownLeftMs(PET_CARE_VERBS_BY_ID['fetch']!, used, NOON + HOUR), 2 * HOUR);
    assert.equal(careVerbBlock(PET_CARE_VERBS_BY_ID['fetch']!, used, { now: NOON + 3 * HOUR, musicPlaying: true }), null);
  });

  it('rolls finds the same way for the same seed, with luck only scaling the rare chance', () => {
    const find = PET_CARE_VERBS_BY_ID['sniff-hunt']!.reward.find!;
    for (let seed = 0; seed < 50; seed += 1) assert.deepEqual(rollPetCareFind(find, createRng(seed), 1), rollPetCareFind(find, createRng(seed), 1));
    const rare = (luck: number) => {
      let n = 0;
      for (let seed = 0; seed < 4000; seed += 1) if (rollPetCareFind(find, createRng(seed), luck)?.rare) n += 1;
      return n;
    };
    assert.ok(rare(2) > rare(1));
  });
});

describe('playing with a pet', () => {
  it('pays XP and one bond, stamps the cooldown, and treats a replay as a no-op', () => {
    const first = play(start(), 'fetch', NOON);
    const grown = first.meta.savedLokPets[0]!;
    assert.ok((grown.exp ?? 0) > 0);
    assert.equal(grown.bond, 1);
    assert.equal(grown.hideoutEvents?.[careClaimKey('fetch')], NOON);
    assert.equal(play(first, 'fetch', NOON + 1000), first);
    const later = play(first, 'fetch', NOON + 4 * HOUR);
    assert.notEqual(later, first);
  });

  it('ignores unknown pets and verbs and verbs that are blocked', () => {
    const s = start();
    assert.equal(play(s, 'no-such-verb', NOON), s);
    assert.equal(reducer(s, { type: 'playWithLokPet', petId: 'ghost', verbId: 'fetch', seed: 1, now: NOON, musicPlaying: true }), s);
    assert.equal(play(s, 'boogie', NOON, 1, false), s);
    assert.equal(play(s, 'sniff-hunt', NOON), s);
  });

  it('never gives more than the daily bond cap or reward allowance across every verb and many days of seeds', () => {
    let s = start([pet({ bond: 20 })]);
    for (const verb of PET_CARE_VERBS) s = play(s, verb.id, NIGHT, 11);
    const bondGain = (s.meta.savedLokPets[0]!.bond ?? 0) - 20;
    assert.ok(bondGain <= BOND_DAILY_CAP);
    assert.ok(s.meta.cred <= 60 + 15);
    assert.ok(s.meta.hideoutLedger.rare <= 1);
  });

  it('applies the same effect as its preview', () => {
    const state = start([pet({ bond: 20 })]);
    const preview = applyPetCare(state.meta, 'p1', 'sniff-hunt', 99, { now: NOON, musicPlaying: false, elixirCap: ELIXIR_CAP });
    const real = play(state, 'sniff-hunt', NOON, 99, false);
    assert.equal(real.meta.cred, preview.meta.cred);
    assert.deepEqual(real.meta.savedLokPets, preview.meta.savedLokPets);
  });
});
