import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createRng } from '@/game/engine/math';
import { rollLokPet } from '@/game/data/lokPets';
import {
  HIDEOUT_EMOTES,
  HIDEOUT_EVENTS,
  HIDEOUT_MOVES,
  HIDEOUT_TEMPERAMENTS,
  eventFits,
  eventReady,
  formatEventLine,
  pickHideoutEvent,
  temperamentFor,
  timeOfDayFor,
  type HideoutEventContext,
} from '@/game/data/hideoutEvents';
import {
  callPets,
  createHideoutPetState,
  createOperatorWalk,
  petPose,
  setEmote,
  startMove,
  stepHideoutPet,
  stepOperatorWalk,
  tapPet,
  checkSpinJackpot,
} from '@/game/engine/hideoutPets';
import { BOND_RANKS } from '@/game/engine/petGrowth';
import { createInitialMeta, normalizeMeta, reducer } from '@/game/state/metaStore';
import type { SavedLokPet } from '@/game/types';

const BANNED = new RegExp(['sig', 'nal'].join(''), 'i');
const RANGE = { min: 100, max: 500 };
const calm: HideoutEventContext = { hour: 14, weather: 'clear', musicPlaying: false, bondRank: 'stranger', temperament: 'chill' };

function pet(over: Partial<SavedLokPet> = {}): SavedLokPet {
  return { id: 'p1', roll: rollLokPet(createRng(7), { fixedVariantId: 'gyro-sentry' }), stamina: 3, level: 1, exp: 0, battlesWon: 0, battlesFought: 0, ...over };
}
const state = (savedLokPets: SavedLokPet[]) => ({ meta: { ...createInitialMeta(), savedLokPets }, lastRun: null, lastCardPackReveal: null });

describe('hideout event data', () => {
  it('has unique ids and only known moves, emotes and bond ranks', () => {
    assert.equal(new Set(HIDEOUT_EVENTS.map((e) => e.id)).size, HIDEOUT_EVENTS.length);
    const ranks = new Set(BOND_RANKS.map((r) => r.id));
    for (const e of HIDEOUT_EVENTS) {
      assert.ok(HIDEOUT_MOVES.includes(e.move), e.id);
      assert.ok(HIDEOUT_EMOTES.includes(e.emote), e.id);
      assert.ok(e.weight > 0 && e.cooldownMs > 0 && e.durationMs >= 1000, e.id);
      assert.ok(e.line.includes('{pet}'), e.id);
      if (e.when.minBond) assert.ok(ranks.has(e.when.minBond), e.id);
      for (const h of e.when.hours ?? []) assert.ok(h >= 0 && h <= 23, e.id);
    }
    assert.ok(HIDEOUT_EVENTS.length >= 14);
  });

  it('avoids the banned word', () => {
    assert.ok(!BANNED.test(JSON.stringify([HIDEOUT_EVENTS, HIDEOUT_TEMPERAMENTS])));
  });

  it('always has something to play, in any weather and time, with or without music', () => {
    for (const weather of ['clear', 'rain', 'fog', 'snow', 'heat'] as const) {
      for (const hour of [2, 7, 13, 19, 23]) {
        for (const musicPlaying of [true, false]) {
          const picked = pickHideoutEvent({ ...calm, weather, hour, musicPlaying }, undefined, 0, () => 0.5);
          assert.ok(picked, `${weather}/${hour}/${musicPlaying}`);
        }
      }
    }
  });

  it('gates events by bond, weather, music, time and hour', () => {
    const byId = (id: string) => HIDEOUT_EVENTS.find((e) => e.id === id)!;
    assert.equal(eventFits(byId('good-friend'), calm), false);
    assert.equal(eventFits(byId('good-friend'), { ...calm, bondRank: 'friend' }), true);
    assert.equal(eventFits(byId('rain-splash'), calm), false);
    assert.equal(eventFits(byId('rain-splash'), { ...calm, weather: 'rain' }), true);
    assert.equal(eventFits(byId('dance-break'), calm), false);
    assert.equal(eventFits(byId('dance-break'), { ...calm, musicPlaying: true }), true);
    assert.equal(eventFits(byId('three-am-visitor'), calm), false);
    assert.equal(eventFits(byId('three-am-visitor'), { ...calm, hour: 3 }), true);
    assert.equal(eventFits(byId('morning-stretch'), { ...calm, hour: 6 }), true);
    assert.equal(timeOfDayFor(6), 'dawn');
    assert.equal(timeOfDayFor(23), 'night');
  });

  it('respects cooldowns and once-only events', () => {
    const knowing = HIDEOUT_EVENTS.find((e) => e.id === 'knowing-look')!;
    assert.equal(eventReady(knowing, undefined, 0), true);
    assert.equal(eventReady(knowing, { 'knowing-look': 1 }, 10 ** 12), false);
    const rain = HIDEOUT_EVENTS.find((e) => e.id === 'rain-splash')!;
    assert.equal(eventReady(rain, { 'rain-splash': 1000 }, 1000 + rain.cooldownMs - 1), false);
    assert.equal(eventReady(rain, { 'rain-splash': 1000 }, 1000 + rain.cooldownMs), true);
  });

  it('weights the pick and fills the line', () => {
    const rainy = { ...calm, weather: 'rain' as const };
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) seen.add(pickHideoutEvent(rainy, undefined, 0, createRng(i))!.id);
    assert.ok(seen.has('rain-splash'));
    const def = HIDEOUT_EVENTS.find((e) => e.id === 'good-friend')!;
    assert.match(formatEventLine(def, { pet: 'Biscuit', you: 'Boss' }), /Biscuit bumps against Boss/);
    assert.match(formatEventLine(def, { pet: 'Biscuit' }), /against you/);
  });

  it('gives each pet a stable temperament', () => {
    assert.equal(temperamentFor('abc').id, temperamentFor('abc').id);
    const seen = new Set(Array.from({ length: 60 }, (_, i) => temperamentFor(`pet-${i}`).id));
    assert.ok(seen.size >= 4);
  });
});

describe('hideout pet movement', () => {
  const rng = createRng(3);
  const step = (p: ReturnType<typeof createHideoutPetState>, op: ReturnType<typeof createOperatorWalk>, now: number, slot = 0) =>
    stepHideoutPet(p, { dt: 16, now, operator: op, slot, range: RANGE, unit: 80, rng });

  it('stops the operator for a rest and keeps it in range', () => {
    const op = createOperatorWalk(RANGE, 0);
    let sawRest = false;
    for (let t = 0; t < 120_000; t += 16) {
      stepOperatorWalk(op, 16, t, RANGE, rng);
      assert.ok(op.x >= RANGE.min && op.x <= RANGE.max);
      if (op.mode === 'rest') sawRest = true;
    }
    assert.ok(sawRest);
  });

  it('follows behind a walking operator without overlapping it', () => {
    const op = createOperatorWalk(RANGE, 0);
    op.mode = 'walk'; op.until = 10 ** 9; op.dir = 1; op.x = 150;
    const p = createHideoutPetState('p1', 150);
    for (let t = 0; t < 4000; t += 16) {
      op.x = Math.min(RANGE.max, op.x + 0.045 * 16);
      step(p, op, t);
    }
    assert.ok(p.x < op.x, `${p.x} < ${op.x}`);
    assert.ok(op.x - p.x < 200);
    assert.equal(p.mode, 'follow');
  });

  it('settles into an idle behavior when the operator rests, and follows again when it walks', () => {
    const op = createOperatorWalk(RANGE, 0);
    op.mode = 'rest'; op.until = 10 ** 9; op.x = 300;
    const p = createHideoutPetState('p1', 280);
    let now = 0;
    for (; now < 6000; now += 16) step(p, op, now);
    assert.equal(p.mode, 'idle');
    op.mode = 'walk';
    step(p, op, now + 16);
    assert.equal(p.mode, 'follow');
  });

  it('comes when called, then goes back to following', () => {
    const op = createOperatorWalk(RANGE, 0);
    op.mode = 'walk'; op.until = 10 ** 9; op.x = 480; op.dir = 1;
    const p = createHideoutPetState('p1', 120);
    callPets([p], 220, 0, RANGE, 80);
    assert.equal(p.mode, 'call');
    let now = 0;
    for (; now < 4000; now += 16) step(p, op, now);
    assert.ok(Math.abs(p.x - 220) < 40, `x=${p.x}`);
    for (; now < 8000; now += 16) step(p, op, now);
    assert.equal(p.mode, 'follow');
  });

  it('runs a dash move and then clears it', () => {
    const op = createOperatorWalk(RANGE, 0);
    const p = createHideoutPetState('p1', 300);
    startMove(p, 'dash', 0, 1000);
    let moved = false;
    for (let t = 0; t < 1200; t += 16) {
      const before = p.x;
      step(p, op, t);
      if (p.x !== before) moved = true;
      assert.ok(p.x >= RANGE.min && p.x <= RANGE.max);
    }
    assert.ok(moved);
    assert.equal(p.move, null);
  });

  it('hops on a tap and does a spin trick on a quick second tap', () => {
    const p = createHideoutPetState('p1', 300);
    assert.equal(tapPet(p, 1000), 'pet');
    assert.equal(p.move?.kind, 'hop');
    assert.equal(p.emote?.kind, 'heart');
    assert.equal(tapPet(p, 1200), 'trick');
    assert.equal(p.move?.kind, 'spin');
    assert.equal(tapPet(p, 5000), 'pet');
  });
});

describe('hideout pet poses', () => {
  it('bounces on the beat when music plays and stays flat in silence', () => {
    const p = createHideoutPetState('p1', 300);
    const quiet = petPose(p, 1000, { active: false, phase: 0, energy: 0 });
    const onBeat = petPose(p, 1000, { active: true, phase: 0, energy: 1 });
    const offBeat = petPose(p, 1000, { active: true, phase: 0.95, energy: 1 });
    assert.ok(onBeat.lift > quiet.lift);
    assert.ok(onBeat.lift > offBeat.lift);
  });

  it('squashes when napping and holds a still pose for reduced motion', () => {
    const p = createHideoutPetState('p1', 300);
    p.mode = 'idle'; p.idleKind = 'nap';
    assert.ok(petPose(p, 0, { active: false, phase: 0, energy: 0 }).scaleY < 0.9);
    startMove(p, 'hop', 0, 700);
    setEmote(p, 'heart', 0);
    const still = petPose(p, 100, { active: true, phase: 0, energy: 1 }, true);
    assert.deepEqual([still.lift, still.scaleX, still.scaleY], [0, 1, 1]);
    assert.equal(still.emote, 'heart');
  });

  it('turns during a spin', () => {
    const p = createHideoutPetState('p1', 300);
    startMove(p, 'spin', 0, 1000);
    const widths = [100, 160, 220, 300].map((t) => petPose(p, t, { active: false, phase: 0, energy: 0 }).scaleX);
    assert.ok(Math.min(...widths) < 1);
  });
});

describe('hideout reducers', () => {
  it('counts only the first petting of the day for bond', () => {
    const day = new Date(2026, 5, 1, 12).getTime();
    const first = reducer(state([pet({ starter: true })]), { type: 'careForLokPet', id: 'p1', now: day });
    const after = first.meta.savedLokPets[0]!;
    assert.ok((after.bond ?? 0) > 0);
    const again = reducer(first, { type: 'careForLokPet', id: 'p1', now: day + 1000 });
    assert.equal(again, first);
    const nextDay = reducer(first, { type: 'careForLokPet', id: 'p1', now: day + 24 * 3_600_000 });
    assert.ok((nextDay.meta.savedLokPets[0]!.bond ?? 0) > (after.bond ?? 0));
  });

  it('plays an event once per cooldown and pays a little XP and bond', () => {
    const now = new Date(2026, 5, 1, 12).getTime();
    const s0 = state([pet({ starter: true })]);
    const s1 = reducer(s0, { type: 'completeHideoutEvent', petId: 'p1', eventId: 'good-friend', now });
    const p1 = s1.meta.savedLokPets[0]!;
    assert.ok(p1.hideoutEvents?.['good-friend']);
    assert.ok((p1.exp ?? 0) > 0 || (p1.level ?? 1) > 1);
    assert.ok((p1.bond ?? 0) > 0);
    assert.equal(reducer(s1, { type: 'completeHideoutEvent', petId: 'p1', eventId: 'good-friend', now: now + 1000 }), s1);
    assert.equal(reducer(s0, { type: 'completeHideoutEvent', petId: 'p1', eventId: 'nope', now }), s0);
  });

  it('never replays a once-only event', () => {
    const now = 10 ** 12;
    const s1 = reducer(state([pet()]), { type: 'completeHideoutEvent', petId: 'p1', eventId: 'knowing-look', now });
    assert.equal(reducer(s1, { type: 'completeHideoutEvent', petId: 'p1', eventId: 'knowing-look', now: now + 10 ** 10 }), s1);
  });

  it('has settings that default on and clean bad values', () => {
    const meta = createInitialMeta();
    assert.equal(meta.hideoutPets, 'all');
    assert.equal(meta.hideoutEvents, 'on');
    assert.equal(reducer(state([]), { type: 'setHideoutPets', mode: 'companion' }).meta.hideoutPets, 'companion');
    assert.equal(reducer(state([]), { type: 'setHideoutEvents', mode: 'off' }).meta.hideoutEvents, 'off');
    const loaded = normalizeMeta({ ...meta, hideoutPets: 'weird', hideoutEvents: 5 } as never);
    assert.equal(loaded.hideoutPets, 'all');
    assert.equal(loaded.hideoutEvents, 'on');
  });

  it('cleans bad event history and keeps good history', () => {
    const loaded = normalizeMeta({
      ...createInitialMeta(),
      savedLokPets: [{ ...pet({ id: 'a' }), careDay: '2026-06-01', hideoutEvents: { 'good-friend': 12345, bad: 'x', neg: -1 } }, { ...pet({ id: 'b' }), careDay: 'yesterday', hideoutEvents: 'nope' }],
    } as never).savedLokPets;
    assert.deepEqual(loaded[0]!.hideoutEvents, { 'good-friend': 12345 });
    assert.equal(loaded[0]!.careDay, '2026-06-01');
    assert.equal(loaded[1]!.hideoutEvents, undefined);
    assert.equal(loaded[1]!.careDay, undefined);
  });
});

describe('hideout spin streaks', () => {
  it('gets dizzy at 6 quick taps and sick at 14, and a sick pet ignores taps', () => {
    const p = createHideoutPetState('p1', 300);
    let now = 1000;
    const results: string[] = [];
    for (let i = 0; i < 14; i += 1) { results.push(tapPet(p, now)); now += 200; }
    assert.notEqual(results[4], 'dizzy');
    assert.equal(results[5], 'dizzy');
    assert.equal(results[13], 'sick');
    assert.equal(p.emote?.kind, 'sick');
    assert.equal(tapPet(p, now), 'sick');
  });

  it('super charges only when left on exactly 249 spins', () => {
    const exact = createHideoutPetState('p1', 300);
    let now = 1000;
    for (let i = 0; i < 249; i += 1) { exact.sickUntil = 0; tapPet(exact, now); now += 1000; }
    assert.equal(checkSpinJackpot(exact, now - 1000 + 100), false, 'still tapping');
    assert.equal(checkSpinJackpot(exact, now + 2000), true);
    assert.equal(checkSpinJackpot(exact, now + 4000), false, 'only once');
    const over = createHideoutPetState('p2', 300);
    for (let i = 0; i < 250; i += 1) { over.sickUntil = 0; tapPet(over, now); now += 1000; }
    assert.equal(checkSpinJackpot(over, now + 2000), false);
  });
});
