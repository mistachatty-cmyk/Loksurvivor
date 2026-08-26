import assert from 'node:assert/strict';
import test from 'node:test';

import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { getEnemy } from '@/game/data/enemies';
import {
  crewActivityEffects,
  normalizeCrewActivities,
  preferredActivitiesForAlly,
  rollCrewActivities,
} from '@/game/data/crewActivities';
import { getCrewRumor, rollCrewRumor } from '@/game/data/crewRumors';
import { rollLokPet } from '@/game/data/lokPets';
import { CHALLENGE_CONTRACTS_BY_ID, VENDOR_CATALOG_BY_ID } from '@/game/data/vendor';
import { WEAPONS_BY_ID } from '@/game/data/weapons';
import {
  createWorld,
  dashPlayer,
  buildResult,
  claimRumorEmergencyHeal,
  hudSnapshot,
  primePhysicsObject,
  spawnLokPet,
  resolveImpactTravel,
  type EnemyActor,
  type Projectile,
  stepWorld,
} from '@/game/engine/world';
import { generateChunk } from '@/game/engine/chunks';
import { createRng } from '@/game/engine/math';
import {
  createInitialMeta,
  effectiveStats,
  getLokPetDiscoveries,
  loadMeta,
  normalizeMeta,
  rewardCredMultiplier,
  reducer,
  startingWeaponLevel,
} from '@/game/state/metaStore';
import type { AreaDef, CharacterDef, LokPetRoll, RunResult } from '@/game/types';

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

function addEnemy(
  world: ReturnType<typeof createWorld>,
  defId = 'nightcrawler',
  x = 28,
  y = 0,
): EnemyActor {
  const def = getEnemy(defId);
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
    falling: false,
    fallStartedAt: 0,
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
    convertedUntil: 0,
    convertedAttackReadyAt: 0,
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
  impactIntensity: Projectile['impactIntensity'] = 3,
): Projectile {
  const projectile: Projectile = {
    uid: 700,
    x: -50,
    y: 0,
    vx: 420,
    vy: 0,
    radius: 5,
    damage: 20,
    impactIntensity,
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

test('impact travel respects authored force, mass, and resistance', () => {
  const light = resolveImpactTravel(3, 0.6);
  const heavy = resolveImpactTravel(3, 3.2);
  const resisted = resolveImpactTravel(3, 0.6, 0.6);
  assert.ok(light > heavy);
  assert.ok(heavy > 0);
  assert.ok(resisted < light);
  assert.equal(resolveImpactTravel(0, 1), 0);
});

function runResult(lokPets: RunResult['lokPets'], cleared: boolean): RunResult {
  return {
    areaId: AREAS[0]!.id,
    characterId: CHARACTERS[0]!.id,
    cleared,
    survivedSec: 30,
    kills: 4,
    level: 2,
    cred: 10,
    killsByEnemy: {},
    newlyUnlockedCharacterIds: [],
    loadout: { weapons: [], passives: [] },
    lootBoxesOpened: lokPets.length,
    openedPrizes: lokPets.map((pet) => pet.name),
    lokPets,
    lokPetDiscoveries: [],
    lootTokensGained: 0,
    completedObjectives: [],
  };
}

function runPet(
  roll: LokPetRoll,
  overrides: Partial<RunResult['lokPets'][number]> = {},
): RunResult['lokPets'][number] {
  return {
    name: roll.name,
    variantId: roll.variantId,
    family: roll.family,
    silhouette: roll.silhouette,
    palette: roll.palette,
    rarity: roll.rarity,
    rarityLabel: roll.rarityLabel,
    attackKind: roll.attackKind,
    element: roll.element,
    elementLabel: roll.elementLabel,
    traitLabel: roll.traitLabel,
    health: roll.stats.health,
    damage: roll.stats.damage,
    cooldownMs: roll.stats.cooldownMs,
    range: roll.stats.range,
    ghosted: false,
    ...overrides,
  };
}

function withStoredMeta<T>(payload: unknown, callback: () => T): T {
  const hadWindow = 'window' in globalThis;
  const previousWindow = globalThis.window;
  const localStorage = {
    getItem: () => (payload === null ? null : JSON.stringify(payload)),
    setItem: () => undefined,
  };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage },
  });
  try {
    return callback();
  } finally {
    if (hadWindow) {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: previousWindow,
      });
    } else {
      delete (globalThis as { window?: unknown }).window;
    }
  }
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
  for (let i = 0; i < 31; i += 1) stepWorld(world, 1 / 30, neutralInput);

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

test('an enemy projectile is absorbed by heavy cover', () => {
  const world = createWorld(
    testArea({ x: 60, y: 0, w: 24, h: 40, kind: 'cover' }),
    testCharacter('chain-whip'),
    CHARACTERS[0].stats,
    7,
  );
  world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;
  const enemy = addEnemy(world, 'crypt-spitter', 120);
  enemy.fireReadyAt = 0;
  const hpBefore = world.player.hp;

  for (let i = 0; i < 30 && world.projectiles.length === 0; i += 1) {
    stepWorld(world, 1 / 30, neutralInput);
  }
  assert.equal(world.projectiles.length, 1);

  for (let i = 0; i < 30 && world.projectiles.length > 0; i += 1) {
    stepWorld(world, 1 / 30, neutralInput);
  }

  assert.equal(world.projectiles.length, 0);
  assert.equal(world.player.hp, hpBefore);
  assert.equal(world.breakables[0]!.broken, false);
});

test('an enemy projectile is absorbed by a reflective surface instead of ricocheting', () => {
  const world = createWorld(
    testArea({ x: 60, y: 0, w: 24, h: 40, kind: 'reflective-surface' }),
    testCharacter('chain-whip'),
    CHARACTERS[0].stats,
    8,
  );
  world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;
  const enemy = addEnemy(world, 'crypt-spitter', 120);
  enemy.fireReadyAt = 0;
  const hpBefore = world.player.hp;

  for (let i = 0; i < 30 && world.projectiles.length === 0; i += 1) {
    stepWorld(world, 1 / 30, neutralInput);
  }
  assert.equal(world.projectiles.length, 1);

  for (let i = 0; i < 30 && world.projectiles.length > 0; i += 1) {
    stepWorld(world, 1 / 30, neutralInput);
  }

  assert.equal(world.projectiles.length, 0);
  assert.equal(world.player.hp, hpBefore);
  assert.equal(world.alerts.some((alert) => alert.text === 'Ricochet'), false);
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

test('persistent hazard fields tick enemies, apply Burning, and hurt the player', () => {
  const world = createWorld(
    testArea({ x: 320, y: 200, w: 20, h: 20, kind: 'barrier' }),
    testCharacter('emberback'),
    CHARACTERS[0]!.stats,
    5,
  );
  const enemy = addEnemy(world, 34, 0);
  world.weapons[0]!.readyAt = 0;
  const hpBefore = enemy.hp;
  for (let i = 0; i < 25; i += 1) stepWorld(world, 1 / 30, neutralInput);
  assert.ok(world.effects.some((effect) => effect.kind === 'hazard'));
  assert.ok(enemy.hp < hpBefore);
  assert.ok(enemy.activeEffects.some((effect) => effect.id === 'burning' || effect.id === 'acid'));
  assert.ok(world.player.hp < world.player.maxHp);
});

test('teleport weapons blink near a target and damage on arrival', () => {
  const world = createWorld(
    testArea({ x: 320, y: 200, w: 20, h: 20, kind: 'barrier' }),
    testCharacter('glass-eel'),
    CHARACTERS[0]!.stats,
    6,
  );
  const enemy = addEnemy(world, 120, 0);
  world.weapons[0]!.readyAt = 0;
  stepWorld(world, 1 / 30, neutralInput);
  assert.ok(Math.abs(world.player.x - enemy.x) < 45);
  assert.ok(enemy.hp < enemy.maxHp);
  assert.ok(world.effects.some((effect) => effect.kind === 'teleport'));
});

test('converted enemies attack nearby hostiles while conversion is active', () => {
  const world = createWorld(
    testArea({ x: 0, y: 0, w: 24, h: 40, kind: 'cover' }),
    testCharacter('allymaker'),
    CHARACTERS[0].stats,
    1,
  );
  const converted = addEnemy(world, 'nightcrawler', 40, 0);
  const hostile = addEnemy(world, 'nightcrawler', 100, 0);
  hostile.uid = 901;
  converted.convertedUntil = 5_000;
  converted.convertedAttackReadyAt = 0;

  stepWorld(world, 1 / 30, neutralInput);

  assert.ok(hostile.hp < hostile.maxHp);
  assert.equal(converted.hp, converted.maxHp);
  assert.equal(world.effects.at(-1)?.kind, 'laser');
  assert.equal(world.effects.at(-1)?.color, '#65f6d1');
  assert.ok((world.effects.at(-1)?.radius ?? 0) > 0);
});

test('converted enemy stops attacking when conversion expires', () => {
  const world = createWorld(
    testArea({ x: 0, y: 0, w: 24, h: 40, kind: 'cover' }),
    testCharacter('allymaker'),
    CHARACTERS[0].stats,
    1,
  );
  const converted = addEnemy(world, 'nightcrawler', 40, 0);
  const hostile = addEnemy(world, 'nightcrawler', 100, 0);
  hostile.uid = 901;
  converted.convertedUntil = 1;
  converted.convertedAttackReadyAt = 0;

  stepWorld(world, 1 / 30, neutralInput);
  const hpAfterExpiry = hostile.hp;
  const allyAttackEffectsAfterExpiry = world.effects.filter((effect) => effect.kind === 'laser').length;
  stepWorld(world, 1 / 30, neutralInput);

  assert.equal(hostile.hp, hpAfterExpiry);
  assert.equal(world.effects.filter((effect) => effect.kind === 'laser').length, allyAttackEffectsAfterExpiry);
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

test('a heavy metal box absorbs a hit, moves under strong impact, and never breaks', () => {
  const world = createWorld(
    testArea({ x: 0, y: 0, w: 56, h: 56, kind: 'metal-box', propVariant: 'heavy-metal' }),
    testCharacter('the-bus'),
    CHARACTERS[0].stats,
    616,
  );
  world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;
  addProjectile(world, 'block', 5);

  for (let i = 0; i < 12 && world.projectiles.length > 0; i += 1) {
    stepWorld(world, 1 / 30, neutralInput);
  }
  const box = world.breakables[0]!;
  assert.ok(box.vx > 0);
  assert.equal(box.broken, false);
  assert.equal(box.hp, Number.POSITIVE_INFINITY);

  const xBefore = box.x;
  for (let i = 0; i < 20; i += 1) stepWorld(world, 1 / 30, neutralInput);
  assert.ok(box.x > xBefore);
});

test('clicking a movable prop primes one reverse launch and gives it a damaging path', () => {
  const world = createWorld(
    testArea({ x: 80, y: 0, w: 56, h: 42, kind: 'car', propVariant: 'medium-movable' }),
    testCharacter('chain-whip'),
    CHARACTERS[0].stats,
    623,
  );
  world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;
  const prop = world.breakables[0]!;

  addShockEffect(world, prop.x);
  stepWorld(world, 1 / 60, neutralInput);
  const ordinarySpeed = Math.abs(prop.vx);
  assert.ok(ordinarySpeed > 0);
  prop.vx = 0;
  prop.vy = 0;

  const enemy = addEnemy(world, 'nightcrawler', 116, 0);
  enemy.speed = 0;
  world.breakables[0]!.nextEnemyImpactAt = Number.POSITIVE_INFINITY;
  const primed = primePhysicsObject(world, prop.x, prop.y);
  assert.equal(primed, prop);
  assert.equal(prop.clickPrimed, true);

  addShockEffect(world, prop.x);
  stepWorld(world, 1 / 60, neutralInput);
  assert.equal(prop.clickPrimed, false);
  assert.ok(prop.vx < 0, 'the boosted launch should reverse the previous rightward impact');
  assert.ok(Math.abs(prop.vx) > ordinarySpeed * 3);

  for (let i = 0; i < 20; i += 1) stepWorld(world, 1 / 60, neutralInput);
  assert.ok(enemy.hp < enemy.maxHp, 'the moving prop should damage an enemy along its travel path');
});

test('enemy contact launches an impact chain and lethal hits accelerate the follow-through', () => {
  const world = createWorld(
    testArea({ x: 0, y: 0, w: 56, h: 42, kind: 'car', propVariant: 'medium-movable' }),
    testCharacter('chain-whip'),
    CHARACTERS[0].stats,
    628,
  );
  world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;
  world.player.x = -350;
  const prop = world.breakables[0]!;
  const bumper = addEnemy(world, 'nightcrawler', 28, 0);
  bumper.speed = 0;

  stepWorld(world, 1 / 60, neutralInput);
  assert.equal(prop.chainActive, true);
  assert.ok(prop.vx < 0, 'the enemy should launch the prop away from its contact point');
  assert.ok(prop.chainCycles >= 0);
  assert.ok(world.popups.some((popup) => popup.text === 'IMPACT CHAIN'));

  prop.vx = 960;
  prop.vy = 0;
  prop.chainActive = true;
  prop.chainCycles = 0;
  prop.chainVelocityBudget = 1800;
  prop.nextEnemyImpactAt = Number.POSITIVE_INFINITY;
  prop.chainHitUids.clear();
  world.player.x = -350;
  bumper.x = 80;
  bumper.uid = 901;
  bumper.hp = bumper.maxHp = 1;
  const follow = addEnemy(world, 'nightcrawler', 100, 0);
  follow.uid = 902;
  follow.speed = 0;
  follow.hp = follow.maxHp = 1;
  const final = addEnemy(world, 'nightcrawler', 120, 0);
  final.uid = 903;
  final.speed = 0;
  final.hp = final.maxHp = 1;

  for (let i = 0; i < 2400 && !prop.landedHeatActive; i += 1) {
    stepWorld(world, 1 / 60, neutralInput);
  }
  assert.equal(bumper.dying, true);
  assert.equal(follow.dying, true);
  assert.equal(final.dying, true);
  assert.ok(Math.abs(prop.chainVelocityBudget - 1800 * 0.9 ** 3) < 1, 'each lethal cycle should lose 10% of its available velocity');
  assert.ok(prop.chainCycles >= 3);
  assert.equal(prop.landedHeatActive, true);
  assert.equal(world.kills, 3, 'the chain should use one reward path per enemy');
});

test('dense chain contacts keep a readable hit cadence and resist duplicate launch beats', () => {
  const world = createWorld(
    testArea({ x: 0, y: 0, w: 56, h: 42, kind: 'car', propVariant: 'medium-movable' }),
    testCharacter('chain-whip'),
    CHARACTERS[0].stats,
    630,
  );
  world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;
  world.player.x = -350;
  const prop = world.breakables[0]!;
  prop.chainActive = true;
  prop.chainVelocityBudget = 1800;
  prop.impactIntensity = 3;
  prop.vx = 420;
  prop.nextImpactDamageAt = 0;
  prop.nextEnemyImpactAt = Number.POSITIVE_INFINITY;

  const enemies = [44, 160, 276].map((x, index) => {
    const enemy = addEnemy(world, 'nightcrawler', x, 0);
    enemy.uid = 1000 + index;
    enemy.speed = 0;
    enemy.hp = enemy.maxHp = 1;
    return enemy;
  });
  const hitTimes: number[] = [];
  for (let i = 0; i < 180 && hitTimes.length < enemies.length; i += 1) {
    stepWorld(world, 1 / 60, neutralInput);
    while (hitTimes.length < enemies.filter((enemy) => enemy.dying).length) hitTimes.push(world.now);
  }

  assert.equal(hitTimes.length, 3);
  assert.ok(hitTimes[1]! - hitTimes[0]! >= 110, 'chain hits should have a readable minimum gap');
  assert.ok(hitTimes[2]! - hitTimes[1]! >= 110, 'dense chains should not machine-gun contacts');
  assert.equal(world.kills, 3);
  assert.ok(prop.chainCycles >= 3);
});

test('heavy props remain a useful slow hazard without one-shotting elites', () => {
  const world = createWorld(
    testArea({ x: 0, y: 0, w: 56, h: 56, kind: 'metal-box', propVariant: 'heavy-metal' }),
    testCharacter('chain-whip'),
    CHARACTERS[0].stats,
    631,
  );
  world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;
  world.player.x = -350;
  const prop = world.breakables[0]!;
  const elite = addEnemy(world, 'crypt-bouncer', 30, 0);
  elite.speed = 0;
  elite.hp = elite.maxHp = 110;

  for (let i = 0; i < 30; i += 1) stepWorld(world, 1 / 60, neutralInput);

  assert.equal(prop.chainActive, true);
  assert.ok(Math.hypot(prop.vx, prop.vy) > 0, 'heavy contact should launch a moving hazard');
  assert.ok(elite.hp < elite.maxHp, 'the heavy hazard should still contribute damage');
  assert.ok(elite.hp > elite.maxHp * 0.65, 'elite damage should stay below a burst-sized chunk');
  assert.equal(world.kills, 0);
});

test('a landed three-cycle prop becomes a pulsing heat hazard that burns nearby enemies', () => {
  const world = createWorld(
    testArea({ x: 0, y: 0, w: 56, h: 56, kind: 'car', propVariant: 'medium-movable' }),
    testCharacter('chain-whip'),
    CHARACTERS[0].stats,
    629,
  );
  world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;
  world.player.x = -100;
  const prop = world.breakables[0]!;
  prop.chainActive = true;
  prop.chainCycles = 3;
  prop.landedHeatActive = true;
  prop.heatNextTickAt = 0;
  const enemy = addEnemy(world, 'nightcrawler', 100, 0);
  enemy.speed = 0;
  const enemyHp = enemy.hp;
  const playerHp = world.player.hp;

  stepWorld(world, 1 / 60, neutralInput);

  assert.ok(enemy.hp < enemyHp);
  assert.ok(enemy.activeEffects.some((effect) => effect.id === 'burning'));
  assert.ok(world.player.hp < playerHp);
  assert.equal(prop.landedHeatActive, true);
});

test('physics object click priming respects the saved setting', () => {
  const world = createWorld(
    testArea({ x: 80, y: 0, w: 56, h: 42, kind: 'car' }),
    testCharacter('chain-whip'),
    CHARACTERS[0].stats,
    624,
  );
  world.physicsObjectClicksEnabled = false;
  assert.equal(primePhysicsObject(world, 80, 0), null);
  assert.equal(world.breakables[0]?.clickPrimed, false);
});

test('physics object click setting persists and safely defaults for older saves', () => {
  const enabled = normalizeMeta({ version: 4 });
  assert.equal(enabled.physicsObjectClicksEnabled, true);
  const disabled = normalizeMeta({ version: 4, physicsObjectClicksEnabled: false });
  assert.equal(disabled.physicsObjectClicksEnabled, false);
  const updated = reducer(
    { meta: enabled, lastRun: null },
    { type: 'setPhysicsObjectClicks', enabled: false },
  );
  assert.equal(updated.meta.physicsObjectClicksEnabled, false);
});

test('a dash moves the player diagonally and knocks back each enemy in its swept path once', () => {
  const world = createWorld(
    testArea({ x: 320, y: 200, w: 20, h: 20, kind: 'barrier' }),
    testCharacter('chain-whip'),
    CHARACTERS[0]!.stats,
    625,
  );
  world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;
  const enemy = addEnemy(world, 'nightcrawler', 48, 48);
  enemy.speed = 0;
  const initialPlayerX = world.player.x;
  const initialPlayerY = world.player.y;

  assert.equal(dashPlayer(world, 1, 1), true);
  assert.equal(dashPlayer(world, 1, 0), false, 'a second dash should be blocked during recovery');
  for (let i = 0; i < 8; i += 1) stepWorld(world, 1 / 60, neutralInput);

  assert.ok(world.player.x > initialPlayerX);
  assert.ok(world.player.y > initialPlayerY);
  assert.ok(enemy.kx > 0);
  assert.ok(enemy.ky > 0);
  assert.equal(world.player.dashHitUids.has(enemy.uid), true);
  const knockbackX = enemy.kx;
  const knockbackY = enemy.ky;
  for (let i = 0; i < 8; i += 1) stepWorld(world, 1 / 60, neutralInput);
  assert.ok(enemy.kx < knockbackX);
  assert.ok(enemy.ky < knockbackY);
  assert.equal(world.player.dashHitUids.has(enemy.uid), true);
});

test('dash input is ignored after a run ends and becomes available after recovery', () => {
  const world = createWorld(
    testArea({ x: 320, y: 200, w: 20, h: 20, kind: 'barrier' }),
    testCharacter('chain-whip'),
    CHARACTERS[0]!.stats,
    626,
  );
  assert.equal(dashPlayer(world, 1, 0), true);
  for (let i = 0; i < 55; i += 1) stepWorld(world, 1 / 60, neutralInput);
  assert.equal(dashPlayer(world, -1, 0), true);
  world.outcome = 'dead';
  assert.equal(dashPlayer(world, 1, 0), false);

  const endlessArea = AREAS.find((area) => area.endless);
  assert.ok(endlessArea);
  const transitionWorld = createWorld(endlessArea, testCharacter('chain-whip'), CHARACTERS[0]!.stats, 627);
  transitionWorld.endless!.pendingTransition = 'enter';
  assert.equal(dashPlayer(transitionWorld, 1, 0), false);
});

test('a fixed bench blocks but ignores impact and damage', () => {
  const world = createWorld(
    testArea({ x: 0, y: 0, w: 112, h: 28, kind: 'bench', propVariant: 'fixed-bench' }),
    testCharacter('the-bus'),
    CHARACTERS[0].stats,
    617,
  );
  world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;
  addProjectile(world, 'block', 5);

  for (let i = 0; i < 12 && world.projectiles.length > 0; i += 1) {
    stepWorld(world, 1 / 30, neutralInput);
  }
  const bench = world.breakables[0]!;
  assert.equal(bench.vx, 0);
  assert.equal(bench.vy, 0);
  assert.equal(bench.broken, false);
  assert.equal(bench.hp, Number.POSITIVE_INFINITY);
  assert.equal(world.projectiles.length, 0);
});

test('a moving prop can damage an enemy without creating a second kill reward', () => {
  const world = createWorld(
    testArea({ x: 0, y: 0, w: 56, h: 56, kind: 'metal-box', propVariant: 'heavy-metal' }),
    testCharacter('the-bus'),
    CHARACTERS[0].stats,
    618,
  );
  world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;
  const primary = addEnemy(world, 'nightcrawler', 70, 0);
  const nearby = addEnemy(world, 'nightcrawler', 30, 0);
  primary.speed = 0;
  nearby.speed = 0;
  primary.hp = primary.maxHp = 500;
  nearby.hp = nearby.maxHp = 500;
  world.breakables[0]!.vx = 180;
  world.breakables[0]!.impactIntensity = 5;

  for (let i = 0; i < 3; i += 1) stepWorld(world, 1 / 30, neutralInput);
  assert.ok(nearby.hp < nearby.maxHp);
  assert.equal(world.kills, 0);
});

test('a lethal impact burst damages nearby enemies once without duplicating rewards', () => {
  const world = createWorld(
    testArea({ x: 260, y: 200, w: 20, h: 20, kind: 'barrier' }),
    testCharacter('the-bus'),
    CHARACTERS[0].stats,
    619,
  );
  world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;
  const primary = addEnemy(world, 'nightcrawler', 28, 0);
  const nearby = addEnemy(world, 'nightcrawler', 62, 0);
  primary.speed = 0;
  nearby.speed = 0;
  primary.hp = primary.maxHp = 500;
  nearby.hp = nearby.maxHp = 500;
  addProjectile(world, 'block', 5);

  for (let i = 0; i < 8; i += 1) stepWorld(world, 1 / 30, neutralInput);
  assert.ok(primary.hp < primary.maxHp);
  assert.ok(nearby.hp < nearby.maxHp);
  assert.equal(world.kills, 0);
  assert.ok(world.effects.some((effect) => effect.kind === 'nova'));
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

function addShockEffect(
  world: ReturnType<typeof createWorld>,
  x: number,
  impactTrigger?: 'stomp' | 'ground-shock',
  durationMs = 16,
) {
  world.effects.push({
    uid: 12_000 + world.effects.length,
    kind: 'slash',
    x,
    y: 0,
    radius: 48,
    angle: 0,
    spread: Math.PI,
    bornAt: world.now,
    expiresAt: world.now + durationMs,
    color: '#fff',
    damage: 1,
    impactIntensity: 4,
    impactTrigger,
    hitUids: new Set(),
    followPlayer: false,
  });
}

test('dormant potholes stay harmless and only tagged ground attacks open them', () => {
  const world = createWorld(
    testArea({ x: 0, y: 0, w: 72, h: 54, kind: 'pothole', pothole: { trigger: 'ground-shock' } }),
    testCharacter('chain-whip'),
    CHARACTERS[0]!.stats,
    620,
  );
  world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;

  stepWorld(world, 1 / 60, neutralInput);
  assert.equal(world.potholes[0]?.state, 'dormant');
  assert.equal(world.outcome, 'running');
  assert.equal(world.player.hp, world.player.maxHp);

  addShockEffect(world, 0);
  stepWorld(world, 1 / 60, neutralInput);
  assert.equal(world.potholes[0]?.state, 'dormant');

  addShockEffect(world, 0, 'ground-shock');
  stepWorld(world, 1 / 60, neutralInput);
  assert.equal(world.potholes[0]?.state, 'opening');
  assert.equal(world.outcome, 'running');
});

test('open potholes telegraph, then resolve a player fall exactly once', () => {
  const world = createWorld(
    testArea({ x: 0, y: 0, w: 72, h: 54, kind: 'pothole', pothole: { trigger: 'stomp', openingMs: 120 } }),
    testCharacter('chain-whip'),
    CHARACTERS[0]!.stats,
    621,
  );
  world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;
  addShockEffect(world, 0, 'stomp');
  stepWorld(world, 1 / 60, neutralInput);
  assert.equal(world.potholes[0]?.state, 'opening');

  for (let i = 0; i < 12; i += 1) stepWorld(world, 1 / 60, neutralInput);
  assert.equal(world.potholes[0]?.state, 'open');
  assert.equal(world.outcome, 'dead');
  assert.equal(world.deathCause, 'lethal-pothole');
  assert.equal(world.player.falling, true);
  const fallStartedAt = world.player.fallStartedAt;
  const result = buildResult(world);
  stepWorld(world, 1, neutralInput);
  assert.equal(world.player.fallStartedAt, fallStartedAt);
  assert.equal(buildResult(world).deathCause, result.deathCause);
});

test('enemies fall through an open pothole and use the single reward path', () => {
  const world = createWorld(
    testArea({ x: 100, y: 0, w: 72, h: 54, kind: 'pothole', pothole: { trigger: 'ground-shock', openingMs: 80 } }),
    testCharacter('chain-whip'),
    CHARACTERS[0]!.stats,
    622,
  );
  world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;
  const enemy = addEnemy(world, 'nightcrawler', 100, 0);
  enemy.speed = 0;
  addShockEffect(world, 100, 'ground-shock');
  stepWorld(world, 1 / 60, neutralInput);
  for (let i = 0; i < 8; i += 1) stepWorld(world, 1 / 60, neutralInput);

  assert.equal(world.potholes[0]?.state, 'open');
  assert.equal(enemy.falling, true);
  assert.equal(enemy.dying, true);
  assert.equal(world.kills, 1);
  assert.equal(world.killsByEnemy[enemy.defId], 1);
  assert.equal(world.pickups.filter((pickup) => pickup.kind === 'xp').length, 1);
  stepWorld(world, 1 / 60, neutralInput);
  assert.equal(world.kills, 1);
  assert.equal(world.killsByEnemy[enemy.defId], 1);
});

test('followers spawn, grow, attack, and expire without exceeding the cap', () => {
  const world = createWorld(
    testArea({ x: 320, y: 200, w: 20, h: 20, kind: 'barrier' }),
    testCharacter('allymaker'),
    CHARACTERS[0]!.stats,
    44,
  );
  const enemy = addEnemy(world, 'nightcrawler', 70, 0);
  world.weapons[0]!.readyAt = 0;
  stepWorld(world, 1 / 30, neutralInput);
  assert.equal(world.followers.length, 4);
  world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;
  const smallRadius = world.followers[0]!.radius;
  for (let i = 0; i < 40; i += 1) stepWorld(world, 1 / 30, neutralInput);
  assert.ok(world.followers[0]!.radius > smallRadius);
  assert.ok(enemy.hp < enemy.maxHp);
  for (let i = 0; i < 240; i += 1) stepWorld(world, 1 / 30, neutralInput);
  assert.equal(world.followers.length, 0);
});

test('LokPet rolls are deterministic, bounded, and carry a complete variant sheet', () => {
  const first = rollLokPet(createRng(616));
  const second = rollLokPet(createRng(616));
  assert.deepEqual(first, second);
  assert.ok(['animal', 'ghoul', 'bat', 'mote', 'blob', 'mechanical'].includes(first.family));
  assert.ok(first.name.includes('·'));
  assert.ok(first.stats.health >= 18);
  assert.ok(first.stats.damage >= 1);
  assert.ok(first.stats.cooldownMs >= 400);
  assert.ok(first.stats.lifetimeMs >= 90_000);
  assert.ok(first.traitLabel.includes(first.elementLabel) || first.element === 'none');
});

test('generated LokPets are recorded after both cleared and failed runs', () => {
  const roll = rollLokPet(createRng(616));
  let state = { meta: createInitialMeta(), lastRun: null };

  state = reducer(state, {
    type: 'completeRun',
    result: runResult([runPet(roll)], true),
  });
  assert.equal(state.lastRun?.lokPetDiscoveries?.[0]?.newVariant, true);
  assert.equal(state.meta.lokPetHistory.length, 1);
  assert.equal(state.meta.lokPetHistory[0]?.runNumber, 1);
  assert.equal(state.meta.lokPetHistory[0]?.discoveries[0]?.newVariant, true);
  state = reducer(state, {
    type: 'completeRun',
    result: runResult([runPet(roll)], false),
  });

  assert.equal(state.meta.totalRuns, 2);
  assert.equal(state.meta.lokPetCatalog.length, 1);
  assert.equal(state.meta.lokPetCatalog[0]?.variantId, roll.variantId);
  assert.equal(state.meta.lokPetCatalog[0]?.sightings, 2);
  assert.equal(state.lastRun?.lokPetDiscoveries?.[0]?.newVariant, false);
  assert.equal(state.meta.lokPetHistory.length, 2);
  assert.equal(state.meta.lokPetHistory[0]?.runNumber, 2);
  assert.equal(state.meta.lokPetHistory[0]?.discoveries[0]?.newVariant, false);
});

test('repeated LokPet sightings merge rarities and distinct traits without duplicates', () => {
  const roll = rollLokPet(createRng(44));
  const first = runPet(roll, {
    rarity: 'common',
    attackKind: 'shot',
    element: 'none',
    elementLabel: 'untrusted element',
    traitLabel: 'untrusted trait',
  });
  const second = runPet(roll, {
    rarity: 'mythic',
    attackKind: 'pulse',
    element: 'freeze',
    elementLabel: 'untrusted element',
    traitLabel: 'untrusted trait',
  });
  let state = { meta: createInitialMeta(), lastRun: null };

  state = reducer(state, { type: 'completeRun', result: runResult([first], false) });
  state = reducer(state, { type: 'completeRun', result: runResult([second], false) });
  const entry = state.meta.lokPetCatalog[0]!;

  assert.equal(state.meta.lokPetCatalog.length, 1);
  assert.equal(entry.sightings, 2);
  assert.deepEqual(entry.rarities, ['common', 'mythic']);
  assert.deepEqual(
    entry.traits.map(({ attackKind, element }) => `${attackKind}:${element}`),
    ['shot:none', 'pulse:freeze'],
  );
  assert.equal(entry.traits[0]?.label, 'single shot');
  assert.equal(entry.traits[1]?.label, 'pulsating field · freeze');
});

test('LokPet run discoveries separate new intel from repeat progress', () => {
  const roll = rollLokPet(createRng(44));
  const first = runPet(roll, {
    rarity: 'common',
    attackKind: 'shot',
    element: 'none',
  });
  const second = runPet(roll, {
    rarity: 'mythic',
    attackKind: 'pulse',
    element: 'freeze',
  });
  const firstDelta = getLokPetDiscoveries([], [first, first]);
  assert.equal(firstDelta.length, 1);
  assert.equal(firstDelta[0]?.newVariant, true);
  assert.deepEqual(firstDelta[0]?.newRarities, ['common']);
  assert.deepEqual(firstDelta[0]?.newTraits.map(({ attackKind, element }) => `${attackKind}:${element}`), ['shot:none']);
  assert.equal(firstDelta[0]?.sightings, 2);
  assert.equal(firstDelta[0]?.totalSightings, 2);

  let state = { meta: createInitialMeta(), lastRun: null };
  state = reducer(state, { type: 'completeRun', result: runResult([first], false) });
  const secondDelta = getLokPetDiscoveries(state.meta.lokPetCatalog, [second, second]);
  assert.equal(secondDelta[0]?.newVariant, false);
  assert.deepEqual(secondDelta[0]?.newRarities, ['mythic']);
  assert.deepEqual(secondDelta[0]?.newTraits.map(({ attackKind, element }) => `${attackKind}:${element}`), ['pulse:freeze']);
  assert.equal(secondDelta[0]?.sightings, 2);
  assert.equal(secondDelta[0]?.totalSightings, 3);
});

test('version 1 and version 2 saves retain progression and initialize the catalog', () => {
  for (const version of [1, 2]) {
    const legacySave = {
      version,
      selectedCharacterId: CHARACTERS[0]!.id,
      unlockedCharacterIds: [CHARACTERS[0]!.id],
      clearedAreaIds: [AREAS[0]!.id],
      rescuedAllyIds: [],
      discoveryIds: [],
      bestiary: {},
      totalKills: 17,
      totalRuns: 3,
      bestSurvivalSec: 42,
      cred: 12,
      lootTokens: 2,
      onboarded: true,
    };
    const loaded = withStoredMeta(legacySave, loadMeta);

    assert.equal(loaded.version, 5);
    assert.deepEqual(loaded.clearedAreaIds, [AREAS[0]!.id]);
    assert.equal(loaded.totalKills, 17);
    assert.equal(loaded.totalRuns, 3);
    assert.equal(loaded.cred, 12);
    assert.equal(loaded.lokPetCatalog.length, 0);
  }
});

test('crew activities stay autonomous, preferred, seeded, and safely normalized', () => {
  const allies = ['vee', 'deacon', 'nyx', 'sable', 'mamajo'];
  const first = rollCrewActivities(allies, 12);
  const repeat = rollCrewActivities(allies, 12);
  const next = rollCrewActivities(allies, 13);

  assert.deepEqual(first, repeat);
  assert.notDeepEqual(first, next);
  for (const allyId of allies) {
    assert.ok(preferredActivitiesForAlly(allyId).some((activity) => activity.id === first[allyId]));
  }

  const repaired = normalizeCrewActivities(
    { vee: 'not-an-activity', deacon: 'fortify-doors', unknown: 'field-rations' },
    allies,
    12,
  );
  assert.equal(repaired.vee, first.vee);
  assert.equal(repaired.deacon, 'fortify-doors');
  assert.equal('unknown' in repaired, false);

  const meta = createInitialMeta();
  const crewMeta = {
    ...meta,
    rescuedAllyIds: allies,
    crewActivitySeed: 12,
    crewActivityByAlly: first,
  };
  const effects = crewActivityEffects(crewMeta);
  assert.ok(effects.length >= allies.length);
  assert.ok(effects.every((effect) => ['maxHp', 'armor', 'magnet', 'speed', 'area', 'haste', 'power'].includes(effect.stat)));
  const entered = reducer({ meta: crewMeta, lastRun: null }, { type: 'enterHideout' });
  assert.equal(entered.meta.crewActivitySeed, 13);
  assert.deepEqual(
    entered.meta.crewActivityByAlly,
    rollCrewActivities(allies, 13),
  );
});

test('crew rumors roll once, survive reloads, and consume only on completed runs', () => {
  const activities = { vee: 'fortify-doors' as const, nyx: 'scout-routes' as const };
  const first = rollCrewRumor(['vee', 'nyx'], activities, 8);
  const repeat = rollCrewRumor(['vee', 'nyx'], activities, 8);
  assert.deepEqual(first, repeat);
  assert.ok(first);
  assert.ok(getCrewRumor(first.rumorId)?.activityAffinities.includes(activities[first.allyId as 'vee' | 'nyx']));
  assert.equal(rollCrewRumor([], activities, 8), null);

  let state = {
    meta: {
      ...createInitialMeta(),
      rescuedAllyIds: ['vee', 'nyx'],
      crewActivityByAlly: activities,
      crewActivitySeed: 7,
    },
    lastRun: null,
  };
  state = reducer(state, { type: 'enterHideout' });
  assert.ok(state.meta.activeCrewRumor);
  const reloaded = normalizeMeta(state.meta);
  assert.deepEqual(reloaded.activeCrewRumor, state.meta.activeCrewRumor);
  assert.equal(
    normalizeMeta({
      ...state.meta,
      activeCrewRumor: { rumorId: 'not-real', allyId: 'vee', generatedAtSeed: 8 },
    }).activeCrewRumor,
    null,
  );

  const rumor = state.meta.activeCrewRumor!;
  const world = createWorld(
    AREAS[0]!,
    testCharacter('chain-whip'),
    CHARACTERS[0]!.stats,
    616,
    [],
    1,
    true,
    rumor,
  );
  const result = buildResult(world);
  assert.equal(result.crewRumor?.rumorId, rumor.rumorId);
  state = reducer(state, { type: 'completeRun', result });
  assert.equal(state.meta.activeCrewRumor, null);
});

test('crew rumors apply bounded effects through existing run systems', () => {
  const bellWorld = createWorld(
    testArea({ x: 300, y: 300, w: 30, h: 30, kind: 'crate' }),
    testCharacter('chain-whip'),
    CHARACTERS[0]!.stats,
    616,
    [],
    1,
    true,
    { rumorId: 'bell-shock', allyId: 'vee', generatedAtSeed: 1 },
  );
  const bellEnemy = addEnemy(bellWorld, 'nightcrawler', 18, 0);
  bellEnemy.ghostUntil = 0;
  stepWorld(bellWorld, 1 / 30, neutralInput);
  stepWorld(bellWorld, 1 / 30, neutralInput);
  assert.equal(bellWorld.rumorTriggered, true);
  assert.ok(bellWorld.effects.some((effect) => effect.color === '#fbbf24'));
  assert.ok(Math.abs(bellEnemy.kx) + Math.abs(bellEnemy.ky) > 0);

  const baseWorld = createWorld(testArea({ x: 300, y: 300, w: 30, h: 30, kind: 'crate' }), testCharacter('chain-whip'), CHARACTERS[0]!.stats, 616);
  const shortcutWorld = createWorld(testArea({ x: 300, y: 300, w: 30, h: 30, kind: 'crate' }), testCharacter('chain-whip'), CHARACTERS[0]!.stats, 616, [], 1, true, { rumorId: 'painted-shortcut', allyId: 'nyx', generatedAtSeed: 1 });
  stepWorld(baseWorld, 1 / 60, { moveX: 1, moveY: 0, ultimate: false });
  stepWorld(shortcutWorld, 1 / 60, { moveX: 1, moveY: 0, ultimate: false });
  assert.equal(shortcutWorld.player.vx - baseWorld.player.vx, 44);
  assert.equal(shortcutWorld.rumorTriggered, true);

  const pantryWorld = createWorld(testArea({ x: 300, y: 300, w: 30, h: 30, kind: 'crate' }), testCharacter('chain-whip'), CHARACTERS[0]!.stats, 616, [], 1, true, { rumorId: 'pantry-surge', allyId: 'vee', generatedAtSeed: 1 });
  pantryWorld.player.hp = 1;
  assert.equal(claimRumorEmergencyHeal(pantryWorld), true);
  assert.ok(pantryWorld.player.hp > 1);
  assert.equal(claimRumorEmergencyHeal(pantryWorld), false);

  const magnetWorld = createWorld(testArea({ x: 300, y: 300, w: 30, h: 30, kind: 'crate' }), testCharacter('chain-whip'), CHARACTERS[0]!.stats, 616, [], 1, true, { rumorId: 'magnet-parade', allyId: 'nyx', generatedAtSeed: 1 });
  magnetWorld.rumorMagnetNextAt = 0;
  magnetWorld.pickups.push({ uid: 990, kind: 'xp', x: 200, y: 0, vx: 0, vy: 0, value: 4, bornAt: 0 });
  stepWorld(magnetWorld, 1 / 60, neutralInput);
  assert.equal(magnetWorld.rumorTriggered, true);
  assert.ok(Math.abs(magnetWorld.pickups[0]?.vx ?? 0) > 0);

  const broadcastWorld = createWorld(AREAS.find((area) => area.endless)!, testCharacter('chain-whip'), CHARACTERS[0]!.stats, 616, [], 1, true, { rumorId: 'basement-broadcast', allyId: 'sable', generatedAtSeed: 1 });
  broadcastWorld.endless!.maxDistancePx = 4000;
  broadcastWorld.time = 49.99;
  broadcastWorld.now = 49_990;
  stepWorld(broadcastWorld, 1 / 30, neutralInput);
  assert.equal(broadcastWorld.rumorBroadcastAvailable, false);
  assert.ok(broadcastWorld.alerts.some((alert) => alert.text.includes('RUMOR')));
});

test('vendor purchases spend cred exactly once and stop at the catalog cap', () => {
  const item = VENDOR_CATALOG_BY_ID['running-shoes']!;
  let state = { meta: { ...createInitialMeta(), cred: item.cost * 3 }, lastRun: null };

  state = reducer(state, { type: 'buyVendorItem', id: item.id });
  assert.equal(state.meta.cred, item.cost * 2);
  assert.equal(state.meta.vendorPurchases[item.id], 1);

  state = reducer(state, { type: 'buyVendorItem', id: item.id });
  assert.equal(state.meta.cred, item.cost);
  assert.equal(state.meta.vendorPurchases[item.id], 2);

  state = reducer(state, { type: 'buyVendorItem', id: item.id });
  assert.equal(state.meta.cred, 0);
  assert.equal(state.meta.vendorPurchases[item.id], 3);
  state = reducer(state, { type: 'buyVendorItem', id: item.id });
  assert.equal(state.meta.cred, 0);
  assert.equal(state.meta.vendorPurchases[item.id], 3);
});

test('vendor save migration sanitizes unknown ids and clamps stacks', () => {
  const item = VENDOR_CATALOG_BY_ID['reinforced-hoodie']!;
  const normalized = normalizeMeta({
    version: 4,
    cred: 40,
    vendorPurchases: {
      [item.id]: 999,
      'not-a-real-item': 80,
      'negative-item': -4,
    },
  });

  assert.equal(normalized.vendorPurchases[item.id], item.maxStacks);
  assert.equal(normalized.vendorPurchases['not-a-real-item'], undefined);
  assert.equal(normalized.vendorPurchases['negative-item'], undefined);

  const refreshed = withStoredMeta(
    { version: 4, cred: 40, vendorPurchases: { [item.id]: 2 } },
    loadMeta,
  );
  assert.equal(refreshed.vendorPurchases[item.id], 2);
});

test('vendor stat caps and utilities affect runs without developer unlock grants', () => {
  const base = createInitialMeta();
  const meta = {
    ...base,
    devModeAllUnlocks: true,
    vendorPurchases: {
      'reinforced-hoodie': 99,
      'plated-vest': 99,
      'starting-edge': 2,
      'scavenger-cut': 3,
    },
  };
  const armoredCharacter = {
    ...CHARACTERS[0]!,
    stats: { ...CHARACTERS[0]!.stats, armor: 0.55 },
  };
  const stats = effectiveStats(armoredCharacter, meta);

  assert.equal(stats.armor, 0.6);
  assert.ok(stats.maxHp <= 300);
  assert.equal(startingWeaponLevel(meta), 3);
  assert.equal(rewardCredMultiplier(meta), 1.3);

  const noPurchases = effectiveStats(CHARACTERS[0]!, { ...base, devModeAllUnlocks: true });
  assert.equal(noPurchases.maxHp, CHARACTERS[0]!.stats.maxHp);
});

test('owned challenge contracts scale enemy pressure and payout', () => {
  const area: AreaDef = {
    ...AREAS[0]!,
    id: 'challenge-test-area',
    durationSec: 30,
    waves: [{ fromSec: 0, toSec: 30, enemyId: 'nightcrawler', ratePerSec: 1, burst: 1 }],
    obstacles: [],
    rescueAllyId: undefined,
  };
  const redline = CHALLENGE_CONTRACTS_BY_ID.redline!;
  const world = createWorld(area, testCharacter('chain-whip'), CHARACTERS[0]!.stats, 616, [redline]);
  world.cred = 100;
  const result = buildResult(world);

  assert.equal(world.challenges[0]?.id, 'redline');
  assert.equal(result.cred, 130);
  assert.equal(result.challenges?.[0]?.name, redline.name);
  assert.equal(result.challenges?.[0]?.bonusCred, 30);
});

test('malformed catalog records are ignored and cannot inject presentation fields', () => {
  const roll = rollLokPet(createRng(616));
  const loaded = withStoredMeta({
    version: 3,
    lokPetCatalog: [
      null,
      { variantId: 'unknown-variant', sightings: 99 },
      {
        variantId: roll.variantId,
        family: 'unsafe-family',
        silhouette: 'unsafe-silhouette',
        palette: { body: '<script>bad</script>' },
        rarities: ['rare', 'not-a-rarity', 'rare'],
        sightings: 2,
        traits: [
          {
            attackKind: 'shot',
            element: 'fire',
            elementLabel: '<script>bad</script>',
            label: '<img src=x onerror=alert(1)>',
          },
          {
            attackKind: 'shot',
            element: 'fire',
            elementLabel: 'duplicate',
            label: 'duplicate',
          },
          { attackKind: 'not-an-attack', element: 'fire' },
        ],
      },
    ],
    lokPetHistory: [
      null,
      {
        runNumber: 4,
        recordedAt: Date.now(),
        areaId: 'not-a-real-area',
        characterId: 'not-a-real-character',
        discoveries: [{
          variantId: roll.variantId,
          sightings: 2,
          totalSightings: 2,
          newVariant: true,
          newRarities: ['mythic', 'not-a-rarity', 'mythic'],
          newTraits: [
            {
              attackKind: 'pulse',
              element: 'freeze',
              elementLabel: 'untrusted',
              label: '<script>bad</script>',
            },
            { attackKind: 'bad-attack', element: 'freeze' },
          ],
        }],
      },
    ],
  }, loadMeta);
  const entry = loaded.lokPetCatalog[0]!;

  assert.equal(loaded.lokPetCatalog.length, 1);
  assert.deepEqual(entry.palette, roll.palette);
  assert.deepEqual(entry.rarities, ['rare']);
  assert.deepEqual(entry.traits, [{
    attackKind: 'shot',
    element: 'fire',
    elementLabel: 'fire',
    label: 'single shot · fire',
  }]);
  assert.equal(entry.sightings, 2);
  assert.equal(loaded.lokPetHistory.length, 1);
  assert.deepEqual(loaded.lokPetHistory[0]?.discoveries[0]?.newRarities, ['mythic']);
  assert.deepEqual(loaded.lokPetHistory[0]?.discoveries[0]?.newTraits, [{
    attackKind: 'pulse',
    element: 'freeze',
    elementLabel: 'freeze',
    label: 'pulsating field · freeze',
  }]);
});

test('a LokPet chest prize spawns a generated companion and exposes it to the HUD', () => {
  const world = createWorld(
    testArea({ x: 320, y: 200, w: 20, h: 20, kind: 'barrier' }),
    testCharacter('chain-whip'),
    CHARACTERS[0]!.stats,
    616,
  );
  world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;
  // The LokPet entry is the final weighted entry in the prize table.
  world.rng = () => 0.99;
  world.pickups.push({ uid: 800, kind: 'loot-box', x: 0, y: 0, vx: 0, vy: 0, value: 0, bornAt: 0 });

  stepWorld(world, 1 / 60, neutralInput);

  assert.equal(world.lokPets.length, 1);
  assert.equal(world.pendingReel[0]?.kind, 'lokpet');
  assert.equal(world.pendingReel[0]?.lokPet?.variantId, world.lokPets[0]?.variantId);
  const snapshot = hudSnapshot(world);
  assert.equal(snapshot.lokPets.length, 1);
  assert.equal(snapshot.lokPets[0]?.ghost, false);
});

test('LokPets follow, apply elemental attacks, explode, and become transparent ghosts', () => {
  const world = createWorld(
    testArea({ x: 320, y: 200, w: 20, h: 20, kind: 'barrier' }),
    testCharacter('chain-whip'),
    CHARACTERS[0]!.stats,
    44,
  );
  world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;
  const base = rollLokPet(createRng(44));
  const petRoll = {
    ...base,
    attackKind: 'explosion' as const,
    element: 'freeze' as const,
    elementLabel: 'freeze',
    stats: { ...base.stats, cooldownMs: 120, range: 260, explosionRadius: 110 },
  };
  const pet = spawnLokPet(world, petRoll);
  const firstEnemy = addEnemy(world, 'nightcrawler', 78, 0);
  const secondEnemy = addEnemy(world, 'nightcrawler', 98, 0);
  pet.readyAt = 0;

  for (let i = 0; i < 100; i += 1) stepWorld(world, 1 / 60, neutralInput);

  assert.ok(firstEnemy.hp < firstEnemy.maxHp);
  assert.ok(secondEnemy.hp < secondEnemy.maxHp);
  assert.ok(firstEnemy.activeEffects.some((effect) => effect.id === 'freeze') || firstEnemy.dying);
  pet.ghostAt = world.now + 10;
  for (let i = 0; i < 3; i += 1) stepWorld(world, 1 / 60, neutralInput);
  assert.equal(pet.ghost, true);
  assert.equal(hudSnapshot(world).lokPets[0]?.ghost, true);

  pet.expiresAt = world.now + 10;
  for (let i = 0; i < 3; i += 1) stepWorld(world, 1 / 60, neutralInput);
  assert.equal(world.lokPets.length, 0);
  assert.equal(world.lokPetHistory.length, 1);
});

test('formation-tagged waves release deterministic positions', () => {
  const area = {
    ...testArea({ x: 320, y: 200, w: 20, h: 20, kind: 'barrier' }),
    waves: [{ fromSec: 0, toSec: 10, enemyId: 'nightcrawler', ratePerSec: 1, burst: 3, formation: 'wall' as const }],
  };
  const first = createWorld(area, testCharacter('chain-whip'), CHARACTERS[0]!.stats, 91);
  const second = createWorld(area, testCharacter('chain-whip'), CHARACTERS[0]!.stats, 91);
  for (let i = 0; i < 31; i += 1) {
    stepWorld(first, 1 / 30, neutralInput);
    stepWorld(second, 1 / 30, neutralInput);
  }
  assert.equal(first.enemies.length, 3);
  assert.deepEqual(first.enemies.map((enemy) => [enemy.x, enemy.y]), second.enemies.map((enemy) => [enemy.x, enemy.y]));
});

test('city blocks are deterministic and keep a central crossing through river rows', () => {
  const first = generateChunk(4, 3, 616);
  const second = generateChunk(4, 3, 616);
  assert.deepEqual(first, second);
  assert.equal(first.hasRiver, true);
  assert.equal(first.buildings.length, 4);
  assert.ok(first.obstacles.filter((obstacle) => obstacle.kind === 'building').length >= 16);
  assert.equal(first.obstacles.filter((obstacle) => obstacle.kind === 'river').length, 2);
  assert.ok(first.buildingEntrances.length > 0);
});

test('river rows reserve bridges and mark non-crossing edges', () => {
  const bridge = generateChunk(4, 3, 616);
  const riverEdge = generateChunk(5, 3, 616);

  assert.equal(bridge.blockKind, 'bridge');
  assert.equal(bridge.riverCrossingX, 0);
  assert.equal(bridge.landmark?.kind, 'bridge');
  assert.equal(riverEdge.blockKind, 'river-edge');
  assert.equal(riverEdge.riverCrossingX, null);
  assert.equal(riverEdge.obstacles.filter((obstacle) => obstacle.kind === 'river').length, 1);
});

test('endless snapshot exposes loaded blocks, river crossings, and doors', () => {
  const area = AREAS.find((entry) => entry.endless)!;
  const world = createWorld(area, testCharacter('chain-whip'), CHARACTERS[0]!.stats, 616);
  stepWorld(world, 1 / 60, neutralInput);
  const snapshot = hudSnapshot(world);
  assert.ok(snapshot.endless);
  assert.ok(snapshot.endless.cityBlocks.length >= 9);
  assert.ok(snapshot.endless.buildingEntrances.length > 0);
  assert.equal(snapshot.endless.playerX, world.player.x);
});

test('endless buildings expose distinct facades and enterable prefab interiors', () => {
  const area = AREAS.find((entry) => entry.endless)!;
  const world = createWorld(area, testCharacter('chain-whip'), CHARACTERS[0].stats, 616);
  stepWorld(world, 1 / 60, neutralInput);

  const endless = world.endless!;
  assert.ok(endless.buildings.length >= 8);
  assert.ok(new Set(endless.buildings.map((building) => building.prefabId)).size >= 3);
  const door = endless.buildingEntrances[0]!;
  world.player.x = door.x;
  world.player.y = door.y;
  stepWorld(world, 1 / 60, neutralInput);

  assert.equal(endless.inBuilding, true);
  assert.ok(endless.buildingLabel.length > 0);
  assert.ok(world.obstacles.some((obstacle) => obstacle.w > 300 || obstacle.h > 300));
  assert.ok(world.obstacles.some((obstacle) => obstacle.w < 30 && obstacle.h > 100));

  endless.exitZone = { x: world.player.x, y: world.player.y, w: 52, h: 42 };
  stepWorld(world, 1 / 60, neutralInput);
  assert.equal(endless.inBuilding, false);
});

test('entering a landmark block adds a non-blocking navigation cue', () => {
  const area = AREAS.find((entry) => entry.endless)!;
  const world = createWorld(area, testCharacter('chain-whip'), CHARACTERS[0]!.stats, 616);
  stepWorld(world, 1 / 60, neutralInput);

  const landmark = world.endless!.cityBlocks.find((block) => block.landmark);
  assert.ok(landmark);
  world.player.x = landmark!.x;
  world.player.y = landmark!.y;
  stepWorld(world, 1 / 60, neutralInput);

  assert.match(world.alerts.at(-1)?.text ?? '', /Entering|crossing ahead/);
  assert.equal(world.outcome, 'running');
});

test('dungeon visits progress through three rooms and scale the final boss by level', () => {
  const area = AREAS.find((entry) => entry.endless)!;
  const world = createWorld(area, testCharacter('chain-whip'), CHARACTERS[0]!.stats, 616);
  world.level = 7;
  world.endless!.dungeonEntrances = [{ x: 0, y: 0, w: 56, h: 16, chunkKey: 'test' }];
  stepWorld(world, 1 / 60, neutralInput);
  assert.equal(world.endless!.inDungeon, true);
  assert.equal(world.endless!.dungeonRoom, 1);
  for (let room = 2; room <= 3; room += 1) {
    world.endless!.exitZone = { x: world.player.x, y: world.player.y, w: 44, h: 64 };
    stepWorld(world, 1 / 60, neutralInput);
    assert.equal(world.endless!.dungeonRoom, room);
  }
  const boss = world.enemies.find((enemy) => enemy.def.family === 'Boss');
  assert.ok(boss);
  assert.equal(boss.maxHp, 7000);
  assert.equal(world.endless!.dungeonChest?.unlocked, false);
});

test('final dungeon chest is boss-gated and idempotent', () => {
  const area = AREAS.find((entry) => entry.endless)!;
  const world = createWorld(area, testCharacter('chain-whip'), CHARACTERS[0]!.stats, 616);
  world.endless!.inDungeon = true;
  world.endless!.dungeonRoom = 3;
  world.endless!.dungeonCenterX = 0;
  world.endless!.dungeonCenterY = 0;
  world.endless!.dungeonBounds = { w: 560, h: 440 };
  world.endless!.exitZone = { x: 240, y: 0, w: 44, h: 64 };
  world.endless!.dungeonChest = { x: 190, y: 0, unlocked: false, opened: false };
  const boss = getEnemy('the-sire');
  const bossActor = addEnemy(world, boss.id, 30, 0);
  bossActor.hp = 1;
  bossActor.maxHp = 1000;
  world.weapons[0]!.readyAt = 0;

  for (let i = 0; i < 20; i += 1) stepWorld(world, 1 / 60, neutralInput);
  assert.equal(world.endless!.dungeonChest?.unlocked, true);
  const prizesBeforeChest = world.openedPrizes.length;

  world.player.x = 190;
  world.player.y = 0;
  stepWorld(world, 1 / 60, neutralInput);
  assert.equal(world.endless!.dungeonChest?.opened, true);
  assert.equal(world.openedPrizes.length - prizesBeforeChest, 3);
  const prizesAfterChest = world.openedPrizes.length;
  assert.ok(world.lootBoxesOpened >= 1);
  const boxesAfterOpen = world.lootBoxesOpened;
  stepWorld(world, 1 / 60, neutralInput);
  assert.equal(world.lootBoxesOpened, boxesAfterOpen);
  assert.equal(world.openedPrizes.length, prizesAfterChest);
});