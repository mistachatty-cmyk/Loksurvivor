import assert from 'node:assert/strict';
import test from 'node:test';

import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { HORDE_SPIN_TIERS } from '@/game/data/hordeSpin';
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

test('HordeSpin runs a full idle -> spinning -> result -> active -> reward cycle', () => {
  const area = areaWithWave({ ...immediateWave, ratePerSec: 0 });
  const character = CHARACTERS[0]!;
  const world = createWorld(area, character, character.stats, 7, [], 1, true, null, { modifiers: { hordeSpinEnabled: true } });
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
