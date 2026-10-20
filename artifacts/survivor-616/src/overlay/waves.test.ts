import assert from 'node:assert/strict';
import test from 'node:test';

import { getCharacter } from '@/game/data/characters';
import { getEnemy } from '@/game/data/enemies';
import { NORMAL_ENEMY_CAP, createWorld, stepWorld } from '@/game/engine/world';
import { BOSS_AT_PCT, BOSS_AT_SEC, OBJECTIVE_PCT, levelComplete, levelStage, shouldSpawnBoss, type LevelState } from './level';
import { overlayArea } from './pageModel';
import { SPEED_MULT } from './scale';
import { FINALE_BOSS_ID, WAVE_SPAN_SEC, buildOverlayWaves, finaleWave, pageSpawnScale } from './waves';

test('every wave and the finale name a real enemy, with sane windows and rates', () => {
  for (const wave of [...buildOverlayWaves({ blocks: 400 }), finaleWave(100)]) {
    assert.ok(getEnemy(wave.enemyId), `unknown enemy ${wave.enemyId}`);
    assert.ok(wave.toSec > wave.fromSec && wave.ratePerSec > 0 && wave.burst >= 1);
    for (const extra of wave.group ?? []) assert.ok(getEnemy(extra), `unknown group enemy ${extra}`);
  }
  assert.equal(FINALE_BOSS_ID, 'stack-overflow');
});

test('zen builds no waves, and a busier page spawns a little more', () => {
  assert.deepEqual(buildOverlayWaves({ blocks: 400, zen: true }), []);
  const small = buildOverlayWaves({ blocks: 12 });
  const big = buildOverlayWaves({ blocks: 5000 });
  assert.ok(big[0]!.ratePerSec > small[0]!.ratePerSec);
  assert.ok(pageSpawnScale(1) >= 0.9 && pageSpawnScale(1e9) <= 1.5);
});

test('the roster arrives in tiers: the first minute is only weak enemies, bosses come later', () => {
  const waves = buildOverlayWaves({ blocks: 300 });
  const early = waves.filter((w) => w.fromSec < 30).map((w) => w.enemyId);
  assert.deepEqual([...new Set(early)], ['dust-mite']);
  const bosses = waves.filter((w) => w.enemyId === 'heap-colossus');
  assert.ok(bosses.length >= 2 && bosses.every((b) => b.fromSec >= 150));
  assert.equal(waves[waves.length - 1]!.toSec <= WAVE_SPAN_SEC + 6, true);
});

test('boss and completion rules: boss at 40% or 4 minutes, complete at 70% plus a dead boss (zen skips the boss)', () => {
  const base: LevelState = { destroyed: 0, elapsedSec: 0, zen: false, bossSpawned: false, bossKilled: false };
  assert.equal(shouldSpawnBoss(base), false);
  assert.equal(shouldSpawnBoss({ ...base, destroyed: BOSS_AT_PCT }), true);
  assert.equal(shouldSpawnBoss({ ...base, elapsedSec: BOSS_AT_SEC }), true);
  assert.equal(shouldSpawnBoss({ ...base, destroyed: 1, bossSpawned: true }), false, 'only once');
  assert.equal(shouldSpawnBoss({ ...base, destroyed: 1, zen: true }), false);
  assert.equal(levelComplete({ ...base, destroyed: OBJECTIVE_PCT }), false, 'the boss must die too');
  assert.equal(levelComplete({ ...base, destroyed: OBJECTIVE_PCT, bossKilled: true }), true);
  assert.equal(levelComplete({ ...base, destroyed: OBJECTIVE_PCT, zen: true }), true);
  assert.equal(levelStage(base), 'smash');
  assert.equal(levelStage({ ...base, destroyed: 0.8, bossSpawned: true }), 'boss');
  assert.equal(levelStage({ ...base, destroyed: 0.8, bossKilled: true }), 'done');
});

test('a 3 minute scripted survival run never throws or produces NaN and respects the enemy cap', () => {
  const foreman = getCharacter('foreman');
  const world = createWorld(overlayArea({ w: 1280, h: 4000 }), foreman, { ...foreman.stats, speed: foreman.stats.speed * SPEED_MULT }, 77);
  world.area.waves = buildOverlayWaves({ blocks: 400 });
  let peak = 0;
  for (let i = 0; i < 60 * 180 && world.outcome === 'running'; i += 1) {
    // wander in a slow circle so enemies have to chase
    const a = i / 90;
    stepWorld(world, 1 / 60, { moveX: Math.cos(a), moveY: Math.sin(a), ultimate: i % 600 === 0 });
    peak = Math.max(peak, world.enemies.length);
    if (world.pendingLevelUps > 0) world.pendingLevelUps = 0;
    if (world.pendingReel.length > 0) world.pendingReel.length = 0;
    world.propHits.length = 0;
    world.impacts.length = 0;
  }
  assert.ok(Number.isFinite(world.player.x) && Number.isFinite(world.player.y) && Number.isFinite(world.player.hp));
  assert.ok(peak > 5, `only ${peak} enemies ever spawned`);
  assert.ok(peak <= NORMAL_ENEMY_CAP, `enemy cap broken: ${peak}`);
  assert.ok(world.kills > 0, 'the Foreman killed nothing in 3 minutes');
});
