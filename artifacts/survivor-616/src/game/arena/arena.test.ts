import assert from 'node:assert/strict';
import test from 'node:test';

import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { getEnemy } from '@/game/data/enemies';
import { addGuestPlayer, createWorld, stepWorld, type EnemyActor, type World } from '@/game/engine/world';
import { createArenaWorld } from '@/game/arena/arenaWorld';
import { arenaStandings } from '@/game/arena/scoreboard';

function addEnemy(world: World, x: number, y: number): EnemyActor {
  const def = getEnemy('nightcrawler');
  const enemy: EnemyActor = {
    uid: 900 + world.enemies.length,
    defId: def.id,
    def,
    x, y, vx: 0, vy: 0, kx: 0, ky: 0,
    radius: def.radius,
    hp: 1,
    maxHp: 1,
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
    ghostUntil: 0,
    invisibleUntil: 0,
    phaseUntil: 0,
    burstUntil: 0,
    baseRadius: def.radius,
    frozenUntil: 0,
    selectedForThrow: false,
    commanded: false,
    orderKind: 'none',
    orderX: 0,
    orderY: 0,
    selectedForCommand: false,
    capturableUntil: 0,
  };
  world.enemies.push(enemy);
  return enemy;
}

test('createWorld with no arena setup stays single-player-shaped', () => {
  const world = createWorld(AREAS[0]!, CHARACTERS[0]!, CHARACTERS[0]!.stats, 1);
  assert.equal(world.arenaMode, false);
  assert.equal(world.guests.length, 0);
  assert.deepEqual(world.guestKills, {});
});

test('addGuestPlayer flips arenaMode and appends a guest, without touching the host player object', () => {
  const world = createWorld(AREAS[0]!, CHARACTERS[0]!, CHARACTERS[0]!.stats, 1);
  const hostRef = world.player;
  const guest = addGuestPlayer(world, 'p2', CHARACTERS[1]!, 40, 0);
  assert.equal(world.arenaMode, true);
  assert.equal(world.guests.length, 1);
  assert.equal(world.guests[0], guest);
  assert.equal(world.player, hostRef);
});

test('a guest kill is attributed to that guest and still counted in the global tally', () => {
  const world = createWorld(AREAS[0]!, CHARACTERS[0]!, CHARACTERS[0]!.stats, 1);
  const guest = addGuestPlayer(world, 'p2', CHARACTERS[1]!, 200, 0);
  addEnemy(world, guest.x, guest.y);

  const killsBefore = world.kills;
  for (let i = 0; i < 60 && world.guestKills['p2'] === undefined; i += 1) {
    stepWorld(world, 1 / 60, { moveX: 0, moveY: 0, ultimate: false, guestInputs: [{ moveX: 0, moveY: 0 }] });
  }

  assert.equal(world.guestKills['p2'], 1);
  assert.equal(world.kills, killsBefore + 1);
});

test('arena camera follows the centroid of host and guests, not just the host', () => {
  const world = createWorld(AREAS[0]!, CHARACTERS[0]!, CHARACTERS[0]!.stats, 1);
  world.player.x = -100;
  world.player.y = 0;
  addGuestPlayer(world, 'p2', CHARACTERS[1]!, 100, 0);

  for (let i = 0; i < 120; i += 1) {
    stepWorld(world, 1 / 60, { moveX: 0, moveY: 0, ultimate: false, guestInputs: [{ moveX: 0, moveY: 0 }] });
  }

  assert.ok(Math.abs(world.camera.x) < 5, `expected camera to settle near the midpoint, got ${world.camera.x}`);
});

test('createArenaWorld builds the requested seat count and scoreboard reflects it', () => {
  const world = createArenaWorld(AREAS[0]!, [
    { id: 'host', character: CHARACTERS[0]! },
    { id: 'p2', character: CHARACTERS[1]! },
    { id: 'p3', character: CHARACTERS[2]! },
  ]);
  assert.equal(world.guests.length, 2);
  const standings = arenaStandings(world, CHARACTERS[0]!.name);
  assert.equal(standings.length, 3);
  assert.equal(standings.every((row) => row.kills === 0), true);
});
