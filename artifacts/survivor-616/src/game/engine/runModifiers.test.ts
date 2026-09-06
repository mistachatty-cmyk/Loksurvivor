import assert from 'node:assert/strict';
import test from 'node:test';

import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { HORDE_SPIN_TIERS } from '@/game/data/hordeSpin';
import { DISTRICT_INCURSIONS_BY_ID } from '@/game/data/incursions';
import { createWorld, stepWorld } from '@/game/engine/world';
import type { AreaDef, WaveDef } from '@/game/types';

const neutralInput = { moveX: 0, moveY: 0, ultimate: false };

function areaWithWave(wave: WaveDef, obstacles: AreaDef['obstacles'] = []): AreaDef {
  return {
    ...AREAS[0]!,
    id: 'modifier-test-area',
    durationSec: 300,
    obstacles,
    waves: [wave],
    rescueAllyId: undefined,
  };
}

const immediateWave: WaveDef = { fromSec: 0, toSec: 300, enemyId: 'nightcrawler', ratePerSec: 100, burst: 1 };

test('doubleMode raises spawned enemy hp without touching map bounds', () => {
  const area = areaWithWave(immediateWave);
  const character = CHARACTERS[0]!;
  const base = createWorld(area, character, character.stats, 1, [], 1, true, null, {});
  const doubled = createWorld(area, character, character.stats, 1, [], 1, true, null, { modifiers: { doubleMode: true } });
  stepWorld(base, 1 / 30, neutralInput);
  stepWorld(doubled, 1 / 30, neutralInput);
  assert.ok(base.enemies.length > 0 && doubled.enemies.length > 0, 'both worlds should have spawned at least one enemy');
  assert.equal(doubled.bounds.w, base.bounds.w, 'doubleMode must not resize the arena');
  assert.ok(doubled.enemies[0]!.hp > base.enemies[0]!.hp * 1.4, 'doubleMode should meaningfully raise enemy hp');
});

test('scalerMode raises enemy hp with the player level, capped', () => {
  const area = areaWithWave(immediateWave);
  const character = CHARACTERS[0]!;
  const low = createWorld(area, character, character.stats, 1, [], 1, true, null, { modifiers: { scalerMode: true } });
  const high = createWorld(area, character, character.stats, 1, [], 1, true, null, { modifiers: { scalerMode: true } });
  high.level = 40;
  stepWorld(low, 1 / 30, neutralInput);
  stepWorld(high, 1 / 30, neutralInput);
  assert.ok(high.enemies[0]!.hp > low.enemies[0]!.hp, 'a higher level should scale enemy hp up');
});

test('speedMode raises enemy movement speed', () => {
  const area = areaWithWave(immediateWave);
  const character = CHARACTERS[0]!;
  const base = createWorld(area, character, character.stats, 1, [], 1, true, null, {});
  const sped = createWorld(area, character, character.stats, 1, [], 1, true, null, { modifiers: { speedMode: true } });
  stepWorld(base, 1 / 30, neutralInput);
  stepWorld(sped, 1 / 30, neutralInput);
  assert.equal(sped.enemies[0]!.speed, base.enemies[0]!.speed * 1.25);
});

test('invertedMap mirrors the authored obstacle layout left-to-right', () => {
  const area = areaWithWave({ ...immediateWave, ratePerSec: 0 }, [{ x: 120, y: -40, w: 30, h: 30, kind: 'crate' }]);
  const character = CHARACTERS[0]!;
  const normal = createWorld(area, character, character.stats, 1, [], 1, true, null, {});
  const inverted = createWorld(area, character, character.stats, 1, [], 1, true, null, { modifiers: { invertedMap: true } });
  assert.equal(normal.obstacles[0]!.x, 120);
  assert.equal(inverted.obstacles[0]!.x, -120);
  assert.equal(inverted.obstacles[0]!.y, normal.obstacles[0]!.y, 'invertedMap should only flip x, not y');
  assert.equal(inverted.breakables[0]!.x, -120);
});

test('infiniteMode keeps the run going past durationSec and keeps the last wave spawning past its own toSec', () => {
  // Wave and area both end at t=1s, so any spawning seen after that must come
  // from infiniteMode's escalation branch, not the wave's ordinary window.
  const shortWave: WaveDef = { fromSec: 0, toSec: 1, enemyId: 'nightcrawler', ratePerSec: 100, burst: 1 };
  const shortArea: AreaDef = { ...areaWithWave(shortWave), durationSec: 1 };
  const character = CHARACTERS[0]!;
  const timed = createWorld(shortArea, character, character.stats, 1, [], 1, true, null, {});
  const infinite = createWorld(shortArea, character, character.stats, 1, [], 1, true, null, { modifiers: { infiniteMode: true } });
  for (let i = 0; i < 90; i += 1) {
    stepWorld(timed, 1 / 30, neutralInput);
    stepWorld(infinite, 1 / 30, neutralInput);
  }
  assert.equal(timed.outcome, 'cleared', 'a normal timed run should clear once durationSec passes');
  assert.equal(infinite.outcome, 'running', 'infiniteMode should never auto-clear on the timer');
  assert.ok(infinite.enemies.length > 0, 'infiniteMode should keep spawning from the final wave past its own toSec');
});

test('infiniteMode extends every wave tied at the true max toSec, not just the last array entry', () => {
  // Regression test: the first implementation picked "the wave at array
  // index length-1" as the one to extend, but several authored areas (e.g.
  // bar-siege) have their real finale as multiple waves tied at the highest
  // toSec that do NOT sit last in the array. Put the earlier-ending wave
  // last here to reproduce that shape.
  const tiedA: WaveDef = { fromSec: 0, toSec: 60, enemyId: 'bloodhound', ratePerSec: 1, burst: 1 };
  const tiedB: WaveDef = { fromSec: 0, toSec: 60, enemyId: 'nightcrawler', ratePerSec: 1, burst: 1 };
  const earlierButLast: WaveDef = { fromSec: 0, toSec: 40, enemyId: 'corner-cutter', ratePerSec: 1, burst: 1 };
  const area: AreaDef = { ...areaWithWave(tiedA), durationSec: 1, waves: [tiedA, tiedB, earlierButLast] };
  const character = CHARACTERS[0]!;
  const world = createWorld(area, character, character.stats, 1, [], 1, true, null, { modifiers: { infiniteMode: true } });
  // This test only cares about spawn-window bookkeeping, not combat --
  // three overlapping waves would otherwise swarm and kill a stationary
  // level-1 player well before t=60s, freezing w.time (stepWorld no-ops
  // once outcome !== 'running') and making every assertion below vacuous.
  world.player.invulnUntil = Number.POSITIVE_INFINITY;

  // The player's default weapon auto-fires every step, so a live-enemies
  // count alone would confound "stopped spawning" with "got killed off" --
  // count spawns cumulatively instead (alive now + already killed).
  const countOf = (id: string) => world.enemies.filter((e) => e.defId === id).length + (world.killsByEnemy[id] ?? 0);
  for (let elapsed = 0; elapsed < 60; elapsed += 1 / 30) stepWorld(world, 1 / 30, neutralInput);
  const bloodhoundAt60 = countOf('bloodhound');
  const nightcrawlerAt60 = countOf('nightcrawler');
  assert.ok(bloodhoundAt60 > 0 && nightcrawlerAt60 > 0, 'both tied waves should have spawned during their normal window');

  for (let elapsed = 0; elapsed < 15; elapsed += 1 / 30) stepWorld(world, 1 / 30, neutralInput);
  assert.ok(countOf('bloodhound') > bloodhoundAt60, 'the first tied wave should keep spawning past its shared toSec');
  assert.ok(countOf('nightcrawler') > nightcrawlerAt60, 'the second tied wave should keep spawning past its shared toSec too, not just whichever sits last in the array');
});

test('modifierHpMult reaches enemies spawned outside the wave system (e.g. district incursions)', () => {
  // Regression test: modifierHpMult originally lived only in updateSpawning
  // and updateEndlessSpawning, so doubleMode/scalerMode silently never
  // affected district incursions, the endless dungeon boss, or the elite
  // rotation -- every spawn path that calls spawnEnemy directly with its own
  // hpMult. It now lives inside spawnEnemy itself, so this must hold too.
  const def = DISTRICT_INCURSIONS_BY_ID['floodwall-surge']!;
  const area = AREAS.find((candidate) => candidate.id === def.areaId)!;
  const character = CHARACTERS[0]!;

  function triggerIncursion(scalerLevel: number | null) {
    const world = createWorld(area, character, character.stats, 1, [], 1, true, null, {
      districtIncursionId: def.id,
      modifiers: scalerLevel !== null ? { scalerMode: true } : {},
    });
    if (scalerLevel !== null) world.level = scalerLevel;
    world.time = def.triggerAtSec - def.warningLeadSec;
    world.now = world.time * 1000;
    for (let elapsed = 0; elapsed < def.warningLeadSec; elapsed += 1 / 30) stepWorld(world, 1 / 30, neutralInput);
    assert.equal(world.districtIncursion?.phase, 'active');
    return world;
  }

  const base = triggerIncursion(null);
  const scaled = triggerIncursion(40);
  assert.ok(base.enemies.length > 0 && scaled.enemies.length > 0, 'the incursion should have spawned its hand-placed enemies');
  assert.ok(scaled.enemies[0]!.hp > base.enemies[0]!.hp, 'scalerMode should raise incursion enemy hp too, not just wave-spawned enemies');
});

test('HordeSpin runs a full idle -> spinning -> result -> active -> reward cycle', () => {
  const area = areaWithWave({ ...immediateWave, ratePerSec: 0 });
  const character = CHARACTERS[0]!;
  const world = createWorld(area, character, character.stats, 7, [], 1, true, null, { modifiers: { hordeSpinEnabled: true } });
  // A rare high tier (5x5/666) spawns enough enemies that a stationary
  // level-1 player could die before the cycle completes, which would freeze
  // w.time and fail every assertion below for a reason unrelated to what
  // this test checks -- see the infiniteMode test above for the same trap.
  world.player.invulnUntil = Number.POSITIVE_INFINITY;
  assert.ok(world.wheelSpin, 'hordeSpinEnabled should initialize wheel state');
  assert.equal(world.wheelSpin!.phase, 'idle');

  const seenPhases = new Set<string>([world.wheelSpin!.phase]);
  // Generous upper bound: interval + spin + result + the longest active window,
  // at the ~33ms fixed step stepWorld clamps every call to.
  for (let i = 0; i < 2500 && world.wheelSpin!.spinsThisRun === 0; i += 1) {
    stepWorld(world, 1, neutralInput);
    seenPhases.add(world.wheelSpin!.phase);
  }
  assert.ok(seenPhases.has('spinning'), 'wheel should pass through spinning');
  assert.ok(seenPhases.has('result'), 'wheel should pass through result');
  assert.ok(seenPhases.has('active'), 'wheel should pass through active');
  assert.equal(world.wheelSpin!.spinsThisRun, 1, 'exactly one full cycle should have completed');
  assert.equal(world.wheelSpin!.phase, 'idle', 'the wheel should reset to idle after paying out');
  assert.ok(world.cred > 0, 'clearing a horde should pay a cred reward');
});

test('HORDE_SPIN_TIERS are well-formed', () => {
  const ids = new Set(HORDE_SPIN_TIERS.map((tier) => tier.id));
  assert.equal(ids.size, HORDE_SPIN_TIERS.length, 'tier ids must be unique');
  for (const tier of HORDE_SPIN_TIERS) {
    assert.ok(tier.weight > 0, `${tier.id} must have a positive weight`);
  }
  const rare = HORDE_SPIN_TIERS.filter((tier) => tier.rare);
  assert.ok(rare.some((tier) => tier.id === '5x5') && rare.some((tier) => tier.id === '666'), '5x5 and 666 must be the rare tiers');
});
