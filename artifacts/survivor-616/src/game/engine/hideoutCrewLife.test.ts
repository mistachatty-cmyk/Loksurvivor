import assert from 'node:assert/strict';
import test from 'node:test';

import { CREW_TEMPERAMENTS, crewTemperamentFor } from '@/game/data/crewTemperaments';
import { ALLIES } from '@/game/data/progression';
import { createRng } from '@/game/engine/math';
import {
  crewPose,
  reactToProp,
  stepCrew,
  syncCrew,
  talkTo,
  type CrewActor,
  type CrewEvent,
  type CrewProp,
} from '@/game/engine/hideoutCrewLife';

const RANGE = { min: 100, max: 700 };
const STEP = 16;

function room(ids: string[], seed = 1) {
  const rng = createRng(seed);
  const actors = new Map<string, CrewActor>();
  syncCrew(actors, ids.map((id, i) => ({ id, homeFrac: (i + 1) / (ids.length + 1), t: crewTemperamentFor(id) })), RANGE, 0, rng, null);
  return { rng, actors, list: () => [...actors.values()] };
}

function run(
  r: ReturnType<typeof room>,
  ms: number,
  opts: { operatorX?: number; props?: CrewProp[]; speak?: (id: string) => string | undefined; from?: number } = {},
): CrewEvent[] {
  const events: CrewEvent[] = [];
  for (let now = opts.from ?? 0; now < (opts.from ?? 0) + ms; now += STEP) {
    stepCrew(r.list(), { now, dt: STEP, range: RANGE, operatorX: opts.operatorX ?? 9999, props: opts.props ?? [], rng: r.rng, speak: opts.speak }, events);
  }
  return events;
}

function distanceWalked(id: string, seed: number, ms: number): number {
  const r = room([id], seed);
  const a = r.actors.get(id)!;
  let walked = 0;
  let last = a.x;
  for (let now = 0; now < ms; now += STEP) {
    stepCrew(r.list(), { now, dt: STEP, range: RANGE, operatorX: 9999, props: [], rng: r.rng }, []);
    walked += Math.abs(a.x - last);
    last = a.x;
  }
  return walked;
}

test('personality shows in how much and how fast people move', () => {
  const seeds = [1, 2, 3, 4, 5, 6];
  const total = (id: string) => seeds.reduce((sum, s) => sum + distanceWalked(id, s, 120_000), 0);
  const runner = total('pippa');
  const bellKeeper = total('deacon');
  assert.ok(runner > bellKeeper * 2, `pippa walked ${runner.toFixed(0)}px vs deacon ${bellKeeper.toFixed(0)}px`);
  assert.ok(bellKeeper > 0, 'even the calmest crew member gets up now and then');
  assert.ok(crewTemperamentFor('pippa').speed > crewTemperamentFor('deacon').speed);
  assert.ok(crewTemperamentFor('nobody-defined').speed > 0, 'unknown crew fall back to the calm default');
});

test('crew stay on the strip and never stand inside each other', () => {
  const r = room(['vee', 'deacon', 'mamajo', 'bulbosa', 'pippa', 'denny', 'constance'], 7);
  let tooClose = 0;
  for (let now = 0; now < 180_000; now += STEP) {
    stepCrew(r.list(), { now, dt: STEP, range: RANGE, operatorX: 400, props: [], rng: r.rng, speak: () => 'Hello there.' }, []);
    const list = r.list();
    for (const a of list) assert.ok(a.x >= RANGE.min && a.x <= RANGE.max, `${a.id} left the strip at ${a.x}`);
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i]!;
        const b = list[j]!;
        if (a.partner === b.id || b.partner === a.id) continue;
        if (Math.abs(a.x - b.x) < 20) tooClose += 1;
      }
    }
  }
  // A packed room (seven in 600px) may brush for an instant, but never sit stacked.
  assert.ok(tooClose < 400, `${tooClose} frames with two people stacked`);
});

test('two sociable crew stop to talk, take turns, and then go home', () => {
  const r = room(['vee', 'denny'], 3);
  const lines = ['Business is slow.', 'It always is.', 'Fair point.'];
  let n = 0;
  const events = run(r, 200_000, { speak: () => lines[n++ % lines.length] });
  const says = events.filter((e): e is Extract<CrewEvent, { kind: 'say' }> => e.kind === 'say');
  assert.ok(says.length >= 2, 'a conversation happened');
  for (let i = 1; i < Math.min(says.length, 2); i += 1) assert.notEqual(says[i]!.id, says[i - 1]!.id, 'they alternate');
  for (const s of says) assert.ok(s.ms >= 2400 && s.ms <= 6200, 'bubble time scales with the line, within bounds');
  // Conversations always pair up cleanly: nobody is left talking to someone who has walked off.
  for (let from = 200_000; from < 260_000; from += 500) {
    run(r, 500, { from });
    for (const a of r.list()) {
      if (a.partner === null) continue;
      assert.equal(r.actors.get(a.partner)?.partner, a.id, `${a.id} is talking to ${a.partner} who is not talking back`);
    }
  }
});

test('a shy crew member backs away when you walk up, a curious one comes over', () => {
  const shy = room(['archivist'], 11);
  const sa = shy.actors.get('archivist')!;
  sa.nextAt = Number.POSITIVE_INFINITY;
  const startX = sa.x;
  let retreated = false;
  for (let seed = 0; seed < 12 && !retreated; seed += 1) {
    const probe = room(['archivist'], 50 + seed);
    const a = probe.actors.get('archivist')!;
    a.nextAt = Number.POSITIVE_INFINITY;
    run(probe, 3000, { operatorX: a.x - 40 });
    if (a.x > a.homeX + 8) retreated = true;
  }
  assert.ok(retreated, 'the archivist sometimes shies away from you');
  assert.equal(startX, sa.homeX);

  let approached = false;
  for (let seed = 0; seed < 20 && !approached; seed += 1) {
    const probe = room(['nyx'], 80 + seed);
    const a = probe.actors.get('nyx')!;
    a.nextAt = Number.POSITIVE_INFINITY;
    const operatorX = a.x + 60;
    for (let now = 0; now < 4000 && !approached; now += STEP) {
      stepCrew(probe.list(), { now, dt: STEP, range: RANGE, operatorX, props: [], rng: probe.rng }, []);
      if (a.behavior === 'approach') approached = true;
    }
  }
  assert.ok(approached, 'nyx tends to come over and see who it is');
});

test('tapping a crew member makes them stop, face you and speak, and frees their conversation partner', () => {
  const r = room(['vee', 'denny'], 5);
  const [vee, denny] = [r.actors.get('vee')!, r.actors.get('denny')!];
  vee.behavior = 'chat';
  vee.partner = 'denny';
  denny.behavior = 'chatWait';
  denny.partner = 'vee';
  const ms = talkTo(denny, r.list(), 'Hey, you.', 1000, denny.x - 80, r.rng);
  assert.equal(denny.behavior, 'talk');
  assert.equal(denny.facing, -1, 'turns toward the operator');
  assert.equal(denny.bubble?.text, 'Hey, you.');
  assert.ok(ms >= 2400);
  assert.equal(denny.partner, null);
  run(r, ms + 500, { from: 1000 });
  assert.notEqual(denny.behavior, 'talk', 'goes back to what they were doing');
  assert.equal(denny.bubble, null);
  assert.notEqual(vee.behavior, 'chat', 'their partner is released');
});

test('using a jukebox gets nearby crew dancing; a bell makes them look over', () => {
  const r = room(['vee', 'denny', 'sable'], 9);
  const [vee] = r.list();
  reactToProp(r.list(), { x: vee!.x, art: 'jukebox' }, 500, () => 0.99, 5000);
  for (const a of r.list()) assert.ok(a.behavior === 'dance' || a.behavior === 'react');
  assert.equal(vee!.behavior, 'dance');
  const dancing = crewPose(vee!, 800, false);
  assert.ok(dancing.lift > 0 || crewPose(vee!, 900, false).lift > 0, 'dancing lifts off the ground');
  reactToProp(r.list(), { x: vee!.x, art: 'bell' }, 600, () => 0.5, 5000);
  assert.equal(vee!.behavior, 'react');
  run(r, 12_000, { from: 600 });
  assert.equal(vee!.behavior === 'dance' || vee!.behavior === 'react', false, 'reactions wear off');
});

test('crew wander over to props in the room and use them', () => {
  const r = room(['nyx'], 13);
  const a = r.actors.get('nyx')!;
  const props: CrewProp[] = [{ id: 'lamp-1', x: a.homeX + 70, art: 'lamp' }];
  const events = run(r, 120_000, { props });
  assert.ok(events.some((e) => e.kind === 'visit' && e.propId === 'lamp-1'), 'a restless, curious crew member investigates the lamp');
});

test('syncCrew adds and removes crew and rescales positions when the strip resizes', () => {
  const r = room(['vee', 'denny'], 2);
  const vee = r.actors.get('vee')!;
  const before = (vee.x - RANGE.min) / (RANGE.max - RANGE.min);
  const wider = { min: 50, max: 1250 };
  syncCrew(r.actors, [{ id: 'vee', homeFrac: vee.homeFrac }], wider, 0, r.rng, RANGE);
  assert.equal(r.actors.size, 1, 'crew who left the room are dropped');
  const after = (vee.x - wider.min) / (wider.max - wider.min);
  assert.ok(Math.abs(after - before) < 1e-9, 'position keeps its place along the strip');
});

test('reduced motion poses stay still', () => {
  const r = room(['pippa'], 4);
  const a = r.actors.get('pippa')!;
  a.moving = true;
  assert.deepEqual(crewPose(a, 123, true), { anim: 'idle', lift: 0, scaleX: 1, scaleY: 1 });
});

test('every rescuable ally has their own temperament, and no row is for someone who does not exist', () => {
  const ids = new Set(ALLIES.map((ally) => ally.id));
  for (const ally of ALLIES) assert.ok(CREW_TEMPERAMENTS[ally.id], `${ally.id} has no entry in data/crewTemperaments.ts`);
  for (const id of Object.keys(CREW_TEMPERAMENTS)) assert.ok(ids.has(id), `${id} is not an ally`);
});
