import assert from 'node:assert/strict';
import test from 'node:test';

import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { ENEMY_QUIRKS } from '@/game/data/enemyQuirks';
import { buildResult, createWorld, damageEnemy, stepWorld } from './world';

const IDLE = { moveX: 0, moveY: 0, ultimate: false };

test('quirked enemies spawn in a real run, behave, and every quirk can be seen', () => {
  const area = {
    ...AREAS[0]!, id: 'quirk-test', obstacles: [], musicEvents: undefined, rescueAllyId: undefined, durationSec: 600,
    waves: [{ fromSec: 0, toSec: 600, enemyId: 'nightcrawler', ratePerSec: 8, burst: 3 }],
  };
  const seen = new Set<string>();
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const world = createWorld(area, CHARACTERS[0]!, { ...CHARACTERS[0]!.stats, maxHp: 1_000_000 }, seed, [], 1, true, null, { enemyQuirks: { enabled: true, disabledIds: [] } });
    world.now = 300_000;
    world.player.hp = world.player.maxHp = 1_000_000;
    for (let frame = 0; frame < 600; frame += 1) {
      stepWorld(world, 1 / 30, IDLE);
      for (const enemy of world.enemies) {
        if (enemy.quirk) seen.add(enemy.quirk);
        assert.ok(Number.isFinite(enemy.x) && Number.isFinite(enemy.y) && Number.isFinite(enemy.hp));
      }
      if (frame === 590) {
        const gilded = world.enemies.find((enemy) => enemy.quirk === 'gilded' && !enemy.dying);
        if (gilded) {
          world.pickups.length = 0;
          gilded.shieldedUntil = 0;
          damageEnemy(world, gilded, 1e9, 0, gilded.x, gilded.y);
          assert.ok(world.pickups.filter((pickup) => pickup.kind === 'cred').length >= 3);
        }
      }
    }
  }
  assert.ok(seen.size >= ENEMY_QUIRKS.length - 2, `saw ${[...seen].join(', ')}`);
});

function quirkedRun(setup: { enemyQuirks?: { enabled: boolean; disabledIds: string[] } }) {
  const area = {
    ...AREAS[0]!, id: 'quirk-toggle-test', obstacles: [], musicEvents: undefined, rescueAllyId: undefined, durationSec: 600,
    waves: [{ fromSec: 0, toSec: 600, enemyId: 'nightcrawler', ratePerSec: 8, burst: 3 }],
  };
  const seen = new Set<string>();
  for (const seed of [11, 12, 13]) {
    const world = createWorld(area, CHARACTERS[0]!, { ...CHARACTERS[0]!.stats, maxHp: 1_000_000 }, seed, [], 1, true, null, setup);
    world.now = 300_000;
    world.player.hp = world.player.maxHp = 1_000_000;
    for (let frame = 0; frame < 450; frame += 1) {
      stepWorld(world, 1 / 30, IDLE);
      for (const enemy of world.enemies) if (enemy.quirk) seen.add(enemy.quirk);
    }
  }
  return seen;
}

test('quirks are off unless the end-game feature enables them', () => {
  assert.equal(quirkedRun({}).size, 0);
  assert.equal(quirkedRun({ enemyQuirks: { enabled: false, disabledIds: [] } }).size, 0);
  assert.ok(quirkedRun({ enemyQuirks: { enabled: true, disabledIds: [] } }).size > 0);
});

test('a switched-off quirk never spawns while the rest still do', () => {
  const off = ['volatile', 'oversized', 'shrunken'];
  const seen = quirkedRun({ enemyQuirks: { enabled: true, disabledIds: off } });
  assert.ok(seen.size > 0);
  for (const id of off) assert.ok(!seen.has(id), `${id} stays off`);
  const all = ENEMY_QUIRKS.map((quirk) => quirk.id);
  assert.equal(quirkedRun({ enemyQuirks: { enabled: true, disabledIds: all } }).size, 0);
});

test('Everywhere puts the quirk on every enemy, bosses included, and kills are counted by quirk', () => {
  const area = {
    ...AREAS[0]!, id: 'quirk-everywhere-test', obstacles: [], musicEvents: undefined, rescueAllyId: undefined, durationSec: 600,
    waves: [
      { fromSec: 0, toSec: 600, enemyId: 'nightcrawler', ratePerSec: 5, burst: 2 },
      { fromSec: 0, toSec: 600, enemyId: 'gen-tile-warden', ratePerSec: 1, burst: 1 },
    ],
  };
  const world = createWorld(area, CHARACTERS[0]!, { ...CHARACTERS[0]!.stats, maxHp: 1_000_000 }, 5, [], 1, true, null, {
    enemyQuirks: { enabled: true, disabledIds: [], everywhereIds: ['gilded'] },
  });
  world.player.hp = world.player.maxHp = 1_000_000;
  for (let frame = 0; frame < 300; frame += 1) stepWorld(world, 1 / 30, IDLE);
  assert.ok(world.enemies.length > 5);
  assert.ok(world.enemies.some((enemy) => enemy.defId === 'gen-tile-warden'));
  for (const enemy of world.enemies) assert.equal(enemy.quirk, 'gilded');
  const before = world.killsByQuirk.gilded ?? 0;
  const victim = world.enemies.find((enemy) => !enemy.dying)!;
  victim.shieldedUntil = 0;
  damageEnemy(world, victim, 1e9, 0, victim.x, victim.y);
  assert.equal(world.killsByQuirk.gilded, before + 1);
  assert.equal(Object.keys(world.killsByQuirk).join(), 'gilded');
});

test('Everywhere is ignored while the quirk is switched off, and while the whole feature is off', () => {
  const run = (enemyQuirks: { enabled: boolean; disabledIds: string[]; everywhereIds: string[] }) => {
    const area = { ...AREAS[0]!, id: 'q', obstacles: [], musicEvents: undefined, rescueAllyId: undefined, durationSec: 600, waves: [{ fromSec: 0, toSec: 600, enemyId: 'nightcrawler', ratePerSec: 5, burst: 2 }] };
    const world = createWorld(area, CHARACTERS[0]!, CHARACTERS[0]!.stats, 8, [], 1, true, null, { enemyQuirks });
    for (let frame = 0; frame < 120; frame += 1) stepWorld(world, 1 / 30, IDLE);
    return world.enemies.filter((enemy) => enemy.quirk === 'gilded').length;
  };
  assert.equal(run({ enabled: true, disabledIds: ['gilded'], everywhereIds: ['gilded'] }), 0);
  assert.equal(run({ enabled: false, disabledIds: [], everywhereIds: ['gilded'] }), 0);
});

test('taken quirks change the player: bigger or smaller body, regeneration and a blocked hit', () => {
  const area = { ...AREAS[0]!, id: 'taken', obstacles: [], musicEvents: undefined, rescueAllyId: undefined, durationSec: 600, waves: [] };
  const make = (takenIds: string[]) => createWorld(area, CHARACTERS[0]!, CHARACTERS[0]!.stats, 3, [], 1, true, null, { enemyQuirks: { enabled: true, disabledIds: [], takenIds } });
  const base = make([]);
  const big = make(['oversized']);
  const small = make(['shrunken']);
  assert.ok(big.player.maxHp > base.player.maxHp && big.player.radius > base.player.radius);
  assert.ok(small.player.maxHp < base.player.maxHp && small.player.radius < base.player.radius);
  const regen = make(['regenerating']);
  regen.player.hp = regen.player.maxHp * 0.5;
  for (let frame = 0; frame < 60; frame += 1) stepWorld(regen, 1 / 30, IDLE);
  assert.ok(regen.player.hp > regen.player.maxHp * 0.5);
  const off = createWorld(area, CHARACTERS[0]!, CHARACTERS[0]!.stats, 3, [], 1, true, null, { enemyQuirks: { enabled: false, disabledIds: [], takenIds: ['oversized'] } });
  assert.equal(off.player.maxHp, base.player.maxHp);
});

test('a Quirk Surge quirks every spawn for 20 seconds, then pays out once', async () => {
  const { QUIRK_SURGE_MS, quirkSurgeStart } = await import('@/game/data/enemyQuirks');
  const area = { ...AREAS[0]!, id: 'surge', obstacles: [], musicEvents: undefined, rescueAllyId: undefined, durationSec: 900, waves: [{ fromSec: 0, toSec: 900, enemyId: 'nightcrawler', ratePerSec: 6, burst: 2 }] };
  const seed = 21;
  const start = quirkSurgeStart(seed);
  assert.ok(start >= 90_000 && start < 210_000);
  const world = createWorld(area, CHARACTERS[0]!, { ...CHARACTERS[0]!.stats, maxHp: 1_000_000 }, seed, [], 1, true, null, { quirkSurgeMode: 'always', enemyQuirks: { enabled: false, disabledIds: [] } });
  world.player.hp = world.player.maxHp = 1_000_000;
  world.now = start - 500;
  const spawnedInSurge: boolean[] = [];
  const seen = new Set<number>();
  for (let frame = 0; frame < 30 * 30; frame += 1) {
    stepWorld(world, 1 / 30, IDLE);
    if (world.now >= start + 1000 && world.now < start + QUIRK_SURGE_MS) {
      for (const enemy of world.enemies) if (!seen.has(enemy.uid)) { seen.add(enemy.uid); spawnedInSurge.push(Boolean(enemy.quirk)); }
    }
  }
  assert.equal(world.quirkSurgePhase, 2);
  assert.equal(world.quirkSurgeWarned, true);
  assert.equal(world.outcome === 'running' ? buildResult(world).quirkSurgeSurvived : true, true);
  assert.ok(spawnedInSurge.length > 20);
  const quirked = spawnedInSurge.filter(Boolean).length / spawnedInSurge.length;
  assert.ok(quirked > 0.9, `surge spawns quirked: ${quirked}`);
  const off = createWorld(area, CHARACTERS[0]!, CHARACTERS[0]!.stats, seed);
  off.now = start + 1000;
  stepWorld(off, 1 / 30, IDLE);
  assert.equal(off.quirkSurgePhase, 0);
});

test('with a chance-mode Surge, some seeds surge and some never do, even with quirks off', () => {
  const area = { ...AREAS[0]!, id: 'surge-chance', obstacles: [], musicEvents: undefined, rescueAllyId: undefined, durationSec: 900, waves: [] };
  let surged = 0;
  let quiet = 0;
  for (let seed = 100; seed < 140; seed += 1) {
    const world = createWorld(area, CHARACTERS[0]!, { ...CHARACTERS[0]!.stats, maxHp: 1_000_000 }, seed, [], 1, true, null, { quirkSurgeMode: 'chance' });
    world.player.hp = world.player.maxHp = 1_000_000;
    world.now = 80_000;
    for (let frame = 0; frame < 30 * 140; frame += 1) stepWorld(world, 1 / 30, IDLE);
    if (world.quirkSurgePhase === 2) surged += 1; else quiet += 1;
  }
  assert.ok(surged > 0 && quiet > 0, `surged ${surged}, quiet ${quiet}`);
});
