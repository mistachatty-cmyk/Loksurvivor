import assert from 'node:assert/strict';
import test from 'node:test';

import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { getEnemy } from '@/game/data/enemies';
import { WEAPONS_BY_ID } from '@/game/data/weapons';
import {
  createWorld,
  type EnemyActor,
  type Projectile,
  stepWorld,
} from '@/game/engine/world';
import type { AreaDef, CharacterDef } from '@/game/types';

const neutralInput = { moveX: 0, moveY: 0, ultimate: false };

function testArea(obstacle: AreaDef['obstacles'][number]): AreaDef {
  return {
    ...AREAS[0],
    id: 'combat-test-area',
    durationSec: 300,
    obstacles: [obstacle],
    waves: [],
    rescueAllyId: undefined,
  };
}

function testCharacter(weaponId: string): CharacterDef {
  const weapon = WEAPONS_BY_ID[weaponId]!;
  return { ...CHARACTERS[0], weapon };
}

function addEnemy(world: ReturnType<typeof createWorld>, x = 28, y = 0): EnemyActor {
  const def = getEnemy('nightcrawler');
  const enemy: EnemyActor = {
    uid: 900,
    defId: def.id,
    def,
    x,
    y,
    vx: 0,
    vy: 0,
    kx: 0,
    ky: 0,
    radius: def.radius,
    hp: 100,
    maxHp: 100,
    facing: -1,
    anim: 'idle',
    animStartedAt: 0,
    hitFlashUntil: 0,
    speed: def.speed,
    damage: def.damage,
    xp: def.xp,
    mass: def.mass,
    contactReadyAt: 0,
    chargeReadyAt: Number.POSITIVE_INFINITY,
    chargeUntil: 0,
    fireReadyAt: Number.POSITIVE_INFINITY,
    weave: 0,
    specialReadyAt: Number.POSITIVE_INFINITY,
    telegraphUntil: 0,
    specialUntil: 0,
    specialRadius: 0,
    specialKind: null,
    dying: false,
    deathAt: 0,
    activeEffects: [],
  };
  world.enemies.push(enemy);
  return enemy;
}

function addProjectile(
  world: ReturnType<typeof createWorld>,
  interaction: Projectile['obstacleInteraction'],
): Projectile {
  const projectile: Projectile = {
    uid: 700,
    x: -50,
    y: 0,
    vx: 420,
    vy: 0,
    radius: 5,
    damage: 20,
    knockback: 0,
    fromPlayer: true,
    expiresAt: Number.POSITIVE_INFINITY,
    targetUid: null,
    turnRate: 0,
    color: '#fff',
    trail: [],
    pierce: 0,
    hitUids: new Set(),
    obstacleUids: new Set(),
    obstacleInteraction: interaction,
  };
  world.projectiles.push(projectile);
  return projectile;
}

test('a projectile is absorbed by heavy cover', () => {
  const world = createWorld(
    testArea({ x: 0, y: 0, w: 24, h: 40, kind: 'cover' }),
    testCharacter('chain-whip'),
    CHARACTERS[0].stats,
    1,
  );
  world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;
  addProjectile(world, 'block');

  for (let i = 0; i < 10 && world.projectiles.length > 0; i += 1) {
    stepWorld(world, 1 / 30, neutralInput);
  }

  assert.equal(world.projectiles.length, 0);
  assert.equal(world.breakables[0]!.broken, false);
  assert.equal(world.breakables[0]!.hp, 173);
});

test('a grouped wave releases its mixed formation together', () => {
  const groupedArea: AreaDef = {
    ...AREAS[0]!,
    id: 'grouped-wave-test',
    durationSec: 30,
    waves: [
      { fromSec: 0, toSec: 30, enemyId: 'nightcrawler', ratePerSec: 1, burst: 2, group: ['spiral-moth'] },
    ],
    obstacles: [],
    rescueAllyId: undefined,
  };
  const world = createWorld(groupedArea, testCharacter('chain-whip'), CHARACTERS[0]!.stats, 616);
  for (let i = 0; i < 30; i += 1) stepWorld(world, 1 / 30, neutralInput);

  assert.equal(world.enemies.length, 4);
  assert.equal(world.enemies.filter((enemy) => enemy.defId === 'nightcrawler').length, 2);
  assert.equal(world.enemies.filter((enemy) => enemy.defId === 'spiral-moth').length, 2);
});

test('a reflective surface redirects a compatible projectile', () => {
  const world = createWorld(
    testArea({ x: 0, y: 0, w: 24, h: 40, kind: 'reflective-surface' }),
    testCharacter('riot-disc'),
    CHARACTERS[0].stats,
    2,
  );
  world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;
  const projectile = addProjectile(world, 'reflect');

  for (let i = 0; i < 10 && world.alerts.length === 0; i += 1) {
    stepWorld(world, 1 / 30, neutralInput);
  }

  assert.ok(world.projectiles.includes(projectile));
  assert.ok(projectile.vx < 0);
  assert.ok(projectile.obstacleUids?.has(world.breakables[0]!.uid));
  assert.ok(world.alerts.some((alert) => alert.text === 'Ricochet'));
});

test('Freeze applies, refreshes, caps at three stacks, stops movement, and expires', () => {
  const world = createWorld(
    testArea({ x: 320, y: 200, w: 20, h: 20, kind: 'barrier' }),
    testCharacter('spray-can'),
    CHARACTERS[0].stats,
    3,
  );
  const enemy = addEnemy(world);
  const weapon = world.weapons[0]!;
  weapon.readyAt = 0;

  stepWorld(world, 1 / 30, neutralInput);
  const freeze = enemy.activeEffects[0]!;
  const firstExpiry = freeze.expiresAt;
  assert.equal(freeze.id, 'freeze');
  assert.equal(freeze.stacks, 1);

  weapon.readyAt = world.now;
  stepWorld(world, 1 / 30, neutralInput);
  assert.equal(freeze.stacks, 2);
  assert.ok(freeze.expiresAt > firstExpiry);

  weapon.readyAt = world.now;
  stepWorld(world, 1 / 30, neutralInput);
  weapon.readyAt = world.now;
  stepWorld(world, 1 / 30, neutralInput);
  assert.equal(freeze.stacks, 3);

  weapon.readyAt = Number.POSITIVE_INFINITY;
  // Isolate the status movement contract from the weapon's intentional
  // knockback impulse.
  enemy.kx = 0;
  enemy.ky = 0;
  const frozenX = enemy.x;
  stepWorld(world, 1 / 30, neutralInput);
  assert.equal(enemy.x, frozenX);

  for (let i = 0; i < 80; i += 1) stepWorld(world, 1 / 30, neutralInput);
  assert.equal(enemy.activeEffects.length, 0);
  const unfrozenX = enemy.x;
  stepWorld(world, 1 / 30, neutralInput);
  assert.ok(enemy.x < unfrozenX);
});

test('ordinary weapons damage enemies without applying Freeze', () => {
  const world = createWorld(
    testArea({ x: 320, y: 200, w: 20, h: 20, kind: 'barrier' }),
    testCharacter('freestyle-mic'),
    CHARACTERS[0].stats,
    4,
  );
  const enemy = addEnemy(world);
  world.weapons[0]!.readyAt = 0;

  stepWorld(world, 1 / 30, neutralInput);

  assert.ok(enemy.hp < enemy.maxHp);
  assert.deepEqual(enemy.activeEffects, []);
});

test('a breakable box blocks a shot, breaks, and drops a pickup', () => {
  const world = createWorld(
    testArea({ x: 0, y: 0, w: 40, h: 40, kind: 'crate-breakable' }),
    testCharacter('chain-whip'),
    CHARACTERS[0].stats,
    5,
  );
  world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;
  world.breakables[0]!.hp = 1;
  addProjectile(world, 'block');

  for (let i = 0; i < 10 && world.projectiles.length > 0; i += 1) {
    stepWorld(world, 1 / 30, neutralInput);
  }

  assert.equal(world.breakables[0]!.broken, true);
  assert.ok(world.pickups.length >= 1);
  assert.equal(world.obstacles.length, 0);
});

test('a destroyed street lamp becomes a temporary electricity hazard', () => {
  const world = createWorld(
    testArea({ x: 0, y: 0, w: 28, h: 30, kind: 'street-lamp' }),
    testCharacter('chain-whip'),
    CHARACTERS[0].stats,
    6,
  );
  world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;
  world.breakables[0]!.hp = 1;
  world.player.x = 150;
  addProjectile(world, 'block');

  for (let i = 0; i < 10 && world.projectiles.length > 0; i += 1) {
    stepWorld(world, 1 / 30, neutralInput);
  }

  const pole = world.breakables[0]!;
  assert.equal(pole.broken, true);
  assert.ok((pole.hazardUntil ?? 0) > world.now);
  assert.equal(world.obstacles.length, 0);

  const hpBefore = world.player.hp;
  world.player.x = 0;
  stepWorld(world, 1 / 30, neutralInput);
  assert.ok(world.player.hp < hpBefore);

  for (let i = 0; i < 180; i += 1) stepWorld(world, 1 / 30, neutralInput);
  assert.ok((pole.hazardUntil ?? 0) <= world.now);
});