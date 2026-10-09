import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createRng } from '@/game/engine/math';
import { HUB_ROOMS } from '@/game/data/progression';
import {
  HIDEOUT_PROPS,
  HIDEOUT_PROPS_BY_ID,
  propClaimKey,
  propReady,
  propsForRoom,
  resolvePropReward,
} from '@/game/data/hideoutProps';
import { PER_GRANT_MAX, type SmallReward } from '@/game/engine/hideoutRewards';
import { bondDayKey } from '@/game/engine/petGrowth';
import { rollLokPet } from '@/game/data/lokPets';
import { createInitialMeta, reducer } from '@/game/state/metaStore';
import type { SavedLokPet } from '@/game/types';

const BANNED = new RegExp(['sig', 'nal'].join(''), 'i');
const EN = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'locales', 'en.json'), 'utf8')) as Record<string, string>;
const NOON = new Date(2026, 9, 6, 12, 0, 0).getTime();
const DAY = 24 * 60 * 60 * 1000;
const NPCS = new Set(['jeremey-frogster', 'jeramy-frogster', 'luvitnot-keeper']);

function rewardsOf(def: (typeof HIDEOUT_PROPS)[number]): SmallReward[] {
  if (def.action.kind !== 'reward') return [];
  const out = def.action.table.map((row) => row.reward);
  if (def.action.rare) out.push(def.action.rare.reward, ...(def.action.rare.fallback ? [def.action.rare.fallback] : []));
  return out;
}

describe('hideout prop data', () => {
  it('has unique ids, real rooms, sensible positions and known npcs', () => {
    assert.equal(new Set(HIDEOUT_PROPS.map((p) => p.id)).size, HIDEOUT_PROPS.length);
    const rooms = new Set(HUB_ROOMS.map((room) => room.id));
    for (const prop of HIDEOUT_PROPS) {
      assert.ok(prop.roomIds.length > 0, prop.id);
      for (const id of prop.roomIds) assert.ok(rooms.has(id), `${prop.id} -> ${id}`);
      assert.ok(prop.x >= 0 && prop.x <= 1, prop.id);
      assert.ok(prop.lineKeys.length > 0, prop.id);
      if (prop.art === 'npc') assert.ok(prop.npcId && NPCS.has(prop.npcId), prop.id);
      if (prop.cooldown !== 'daily' && prop.cooldown !== 'once') assert.ok(prop.cooldown >= 0, prop.id);
    }
    assert.ok(HIDEOUT_PROPS.length >= 10);
  });

  it('only uses text that exists in en.json and avoids the banned word', () => {
    for (const prop of HIDEOUT_PROPS) {
      const keys: string[] = [prop.labelKey, ...prop.lineKeys];
      if (prop.action.kind === 'reward') {
        for (const row of prop.action.table) if (row.textKey) keys.push(row.textKey);
        if (prop.action.rare) keys.push(prop.action.rare.textKey);
      }
      for (const key of keys) {
        assert.ok(EN[key], `${prop.id}: missing ${key}`);
        assert.ok(!BANNED.test(EN[key]!), key);
      }
    }
    assert.ok(!BANNED.test(JSON.stringify(HIDEOUT_PROPS)));
  });

  it('keeps every reward small, and rare finds rare', () => {
    for (const prop of HIDEOUT_PROPS) {
      for (const reward of rewardsOf(prop)) {
        for (const key of ['cred', 'cardCredits', 'lokPetTreats', 'petElixirs', 'skeletonKeys', 'petExp'] as const) {
          assert.ok((reward[key] ?? 0) <= PER_GRANT_MAX[key], `${prop.id}.${key}`);
        }
        assert.equal(reward.skeletonKeys ?? 0, 0, prop.id);
      }
      if (prop.action.kind === 'reward') {
        assert.ok(prop.action.table.length > 0 && prop.action.table.every((row) => row.weight > 0), prop.id);
        if (prop.action.rare) {
          assert.ok(prop.action.rare.baseChance > 0 && prop.action.rare.baseChance <= 0.05, prop.id);
          assert.ok(prop.action.rare.fallback, `${prop.id} needs a fallback`);
        }
      }
    }
  });

  it('lists the props for a room', () => {
    assert.ok(propsForRoom('main-floor').some((p) => p.id === 'relay-crate'));
    assert.deepEqual(propsForRoom('no-such-room'), []);
  });

  it('is ready again only after its cooldown, and daily means the next local day', () => {
    const daily = HIDEOUT_PROPS_BY_ID['bell-cord']!;
    assert.equal(propReady(daily, {}, NOON), true);
    const claims = { [propClaimKey(daily.id)]: NOON };
    assert.equal(propReady(daily, claims, NOON + 60_000), false);
    assert.equal(propReady(daily, claims, NOON + DAY), true);
    const talk = HIDEOUT_PROPS_BY_ID['window-seat']!;
    assert.equal(propReady(talk, { [propClaimKey(talk.id)]: NOON }, NOON + 1), true);
    const once = { ...daily, cooldown: 'once' as const };
    assert.equal(propReady(once, claims, NOON + 10 * DAY), false);
    const timed = { ...daily, cooldown: 3_600_000 };
    assert.equal(propReady(timed, claims, NOON + 3_600_000), true);
  });

  it('rolls the same result for the same seed and only scales the rare chance with luck', () => {
    const crate = HIDEOUT_PROPS_BY_ID['relay-crate']!;
    for (let seed = 1; seed < 60; seed += 1) {
      assert.deepEqual(resolvePropReward(crate, createRng(seed), 1), resolvePropReward(crate, createRng(seed), 1));
    }
    const rareCount = (luck: number) => {
      let n = 0;
      for (let seed = 0; seed < 4000; seed += 1) if (resolvePropReward(crate, createRng(seed), luck)?.rare) n += 1;
      return n;
    };
    assert.ok(rareCount(2) > rareCount(1));
    assert.equal(resolvePropReward(HIDEOUT_PROPS_BY_ID['window-seat']!, createRng(1), 1), null);
  });
});

describe('activating a prop', () => {
  const pet = (): SavedLokPet => ({ id: 'p1', roll: rollLokPet(createRng(7), { fixedVariantId: 'gyro-sentry' }), stamina: 3, level: 1, exp: 0, battlesWon: 0, battlesFought: 0 });
  const start = () => ({ meta: { ...createInitialMeta(), savedLokPets: [pet()], cred: 0 }, lastRun: null, lastCardPackReveal: null });

  it('keeps the daily claim when the daily caps leave nothing to pay', () => {
    const full = start();
    full.meta = { ...full.meta, hideoutLedger: { day: bondDayKey(NOON), granted: { cred: 60 }, events: 0, rare: 0 } };
    const result = reducer(full, { type: 'activateHideoutProp', propId: 'bell-cord', seed: 1, now: NOON });
    assert.equal(result.meta.cred, 0);
    assert.equal(result.meta.hideoutClaims[propClaimKey('bell-cord')], undefined);
  });

  it('pays once per day and treats a replay as a no-op', () => {
    const first = reducer(start(), { type: 'activateHideoutProp', propId: 'bell-cord', seed: 1, now: NOON });
    assert.equal(first.meta.cred, 5);
    assert.ok(first.meta.hideoutClaims[propClaimKey('bell-cord')]);
    const replay = reducer(first, { type: 'activateHideoutProp', propId: 'bell-cord', seed: 2, now: NOON + 1000 });
    assert.equal(replay, first);
    const tomorrow = reducer(first, { type: 'activateHideoutProp', propId: 'bell-cord', seed: 3, now: NOON + DAY });
    assert.equal(tomorrow.meta.cred, 10);
  });

  it('ignores unknown props and props that never pay', () => {
    const s = start();
    assert.equal(reducer(s, { type: 'activateHideoutProp', propId: 'nope', seed: 1, now: NOON }), s);
    assert.equal(reducer(s, { type: 'activateHideoutProp', propId: 'window-seat', seed: 1, now: NOON }), s);
    assert.equal(reducer(s, { type: 'activateHideoutProp', propId: 'pulse-jukebox', seed: 1, now: NOON }), s);
  });

  it('never pays more than the everyday allowance from props in one day', () => {
    let s = start();
    for (const prop of HIDEOUT_PROPS) s = reducer(s, { type: 'activateHideoutProp', propId: prop.id, seed: 9, now: NOON });
    assert.ok(s.meta.cred <= 60 + 15);
    assert.ok(s.meta.hideoutLedger.rare <= 1);
  });
});
