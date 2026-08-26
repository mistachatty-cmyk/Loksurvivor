import assert from 'node:assert/strict';
import test from 'node:test';

import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { getEnemy } from '@/game/data/enemies';
import { rollLokPet } from '@/game/data/lokPets';
import { WEAPONS_BY_ID } from '@/game/data/weapons';
import {
  createWorld,
  hudSnapshot,
  spawnLokPet,
  type EnemyActor,
  type Projectile,
  stepWorld,
} from '@/game/engine/world';
import { generateChunk } from '@/game/engine/chunks';
import { createRng } from '@/game/engine/math';
import {
  createInitialMeta,
  getLokPetDiscoveries,
  loadMeta,
  reducer,
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
  state = reducer(state, {
    type: 'completeRun',
    result: runResult([runPet(roll)], false),
  });

  assert.equal(state.meta.totalRuns, 2);
  assert.equal(state.meta.lokPetCatalog.length, 1);
  assert.equal(state.meta.lokPetCatalog[0]?.variantId, roll.variantId);
  assert.equal(state.meta.lokPetCatalog[0]?.sightings, 2);
  assert.equal(state.lastRun?.lokPetDiscoveries?.[0]?.newVariant, false);
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

    assert.equal(loaded.version, 3);
    assert.deepEqual(loaded.clearedAreaIds, [AREAS[0]!.id]);
    assert.equal(loaded.totalKills, 17);
    assert.equal(loaded.totalRuns, 3);
    assert.equal(loaded.cred, 12);
    assert.equal(loaded.lokPetCatalog.length, 0);
  }
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
  assert.equal(first.obstacles.filter((obstacle) => obstacle.kind === 'building').length, 4);
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