import assert from 'node:assert/strict';
import test from 'node:test';

import { AREAS } from '@/game/data/areas';
import { CHARACTERS, getCharacter } from '@/game/data/characters';
import { WEAPONS_BY_ID } from '@/game/data/weapons';
import { renderWorld } from '@/game/render/draw';
import {
  IMPACT_CAP,
  PROP_HIT_CAP,
  addBreakables,
  createWorld,
  dashPlayer,
  removeBreakables,
  stepWorld,
  type Projectile,
} from '@/game/engine/world';
import type { AreaDef, CharacterDef, ObstacleDef } from '@/game/types';

/**
 * The page overlay runs the game on top of a live web page: DOM elements
 * become `page-block` obstacles that are added to a running world, and the
 * renderer draws onto a transparent canvas. These tests cover that contract
 * without a DOM.
 */

const neutralInput = { moveX: 0, moveY: 0, ultimate: false };

function pageArea(obstacles: ObstacleDef[] = []): AreaDef {
  return {
    ...AREAS[0],
    id: 'page-overlay-test-area',
    durationSec: 300,
    obstacles,
    waves: [],
    rescueAllyId: undefined,
    musicEvents: undefined,
  };
}

function pageCharacter(weaponId = 'the-bus'): CharacterDef {
  return { ...CHARACTERS[0]!, weapon: WEAPONS_BY_ID[weaponId]! };
}

function block(x: number, y: number, hp?: number, domId?: number): ObstacleDef {
  return { x, y, w: 120, h: 40, kind: 'page-block', ...(hp === undefined ? {} : { hp }), ...(domId === undefined ? {} : { domId }) };
}

function shot(damage: number): Projectile {
  return {
    uid: 700,
    x: -50,
    y: 0,
    vx: 420,
    vy: 0,
    radius: 5,
    damage,
    impactIntensity: 3,
    fromPlayer: true,
    expiresAt: Number.POSITIVE_INFINITY,
    targetUid: null,
    turnRate: 0,
    color: '#fff',
    trail: [],
    pierce: 0,
    hitUids: new Set(),
    obstacleUids: new Set(),
    obstacleInteraction: 'block',
  };
}

test('a page-block takes its per-instance hp, is breakable and never moves', () => {
  const world = createWorld(pageArea([block(0, 0, 25, 7)]), pageCharacter(), CHARACTERS[0]!.stats, 801);
  const b = world.breakables[0]!;
  assert.equal(b.kind, 'page-block');
  assert.equal(b.hp, 25);
  assert.equal(b.maxHp, 25);
  assert.equal(b.breakable, true);
  assert.equal(b.movable, false);
  assert.equal(b.domId, 7);

  // A hit with impact intensity must damage it but not launch it.
  world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;
  world.projectiles.push(shot(40)); // 40 * 0.35 = 14 per contact
  for (let i = 0; i < 12 && world.projectiles.length > 0; i += 1) stepWorld(world, 1 / 30, neutralInput);
  assert.equal(b.vx, 0);
  assert.equal(b.vy, 0);
  assert.ok(b.hp < 25, 'projectile should have damaged the block');
});

test('breaking a page-block drops XP and takes it out of collision', () => {
  const world = createWorld(pageArea([block(0, 0, 10, 3)]), pageCharacter(), CHARACTERS[0]!.stats, 802);
  world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;
  const xpBefore = world.pickups.filter((p) => p.kind === 'xp').length;
  world.projectiles.push(shot(100));
  for (let i = 0; i < 12 && !world.breakables[0]!.broken; i += 1) stepWorld(world, 1 / 30, neutralInput);

  assert.equal(world.breakables[0]!.broken, true);
  assert.equal(world.obstacles.length, 0, 'a broken block no longer collides');
  assert.ok(world.pickups.filter((p) => p.kind === 'xp').length > xpBefore, 'page-block pays XP');
});

test('addBreakables / removeBreakables stream blocks into a running world', () => {
  const world = createWorld(pageArea(), pageCharacter(), CHARACTERS[0]!.stats, 803);
  assert.equal(world.breakables.length, 0);

  const added = addBreakables(world, [block(300, 0, 30, 1), block(300, 100, 30, 2), block(300, 200, 30, 3)]);
  assert.equal(added.length, 3);
  assert.equal(world.breakables.length, 3);
  assert.equal(world.obstacles.length, 3);
  assert.deepEqual(added.map((b) => b.domId), [1, 2, 3]);
  assert.equal(new Set(added.map((b) => b.uid)).size, 3, 'each block gets its own uid');
  assert.equal(world.obstacleGridDirty, true);

  removeBreakables(world, new Set([added[1]!.uid]));
  assert.equal(world.breakables.length, 2);
  assert.equal(world.obstacles.length, 2);
  assert.deepEqual(world.breakables.map((b) => b.domId), [1, 3]);

  // No-ops stay cheap and harmless.
  removeBreakables(world, new Set());
  removeBreakables(world, new Set([999999]));
  assert.equal(world.breakables.length, 2);
  assert.deepEqual(addBreakables(world, []), []);
});

test('addBreakables ignores potholes, which are not breakables', () => {
  const world = createWorld(pageArea(), pageCharacter(), CHARACTERS[0]!.stats, 804);
  const added = addBreakables(world, [{ x: 0, y: 0, w: 60, h: 60, kind: 'pothole' }]);
  assert.equal(added.length, 0);
  assert.equal(world.breakables.length, 0);
});

test('hp override only applies to breakable kinds', () => {
  const world = createWorld(
    pageArea([{ x: 0, y: 0, w: 112, h: 28, kind: 'bench', propVariant: 'fixed-bench', hp: 5 }]),
    pageCharacter(),
    CHARACTERS[0]!.stats,
    805,
  );
  assert.equal(world.breakables[0]!.hp, Number.POSITIVE_INFINITY);
});

/** A canvas stand-in that records the calls renderWorld makes and swallows everything else. */
function recordingContext() {
  const calls: string[] = [];
  const frameFills: number[] = [];
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === Symbol.toPrimitive) return () => 0;
      if (prop === 'canvas') return { width: 640, height: 360 };
      if (prop === 'measureText') return () => ({ width: 10 });
      return (...args: unknown[]) => {
        calls.push(String(prop));
        // Full-frame fills are what paint a floor/vignette over the page.
        if (prop === 'fillRect' && args[0] === 0 && args[1] === 0 && args[2] === 640 && args[3] === 360) frameFills.push(1);
        return new Proxy({}, handler);
      };
    },
    set() {
      return true;
    },
  };
  return { ctx: new Proxy({}, handler) as unknown as CanvasRenderingContext2D, calls, frameFills };
}

test('overlay render mode clears instead of painting a floor, and skips the vignette', () => {
  const view = { width: 640, height: 360, dpr: 1, targetViewOverride: 640 };

  const normal = createWorld(pageArea([block(0, 0, 30)]), pageCharacter(), CHARACTERS[0]!.stats, 806);
  const normalCtx = recordingContext();
  renderWorld(normalCtx.ctx, normal, view);
  assert.ok(normalCtx.frameFills.length >= 2, 'normal mode paints a backdrop and a vignette over the whole frame');
  assert.ok(!normalCtx.calls.includes('clearRect'));

  const overlay = createWorld(pageArea([block(0, 0, 30)]), pageCharacter(), CHARACTERS[0]!.stats, 806);
  const overlayCtx = recordingContext();
  renderWorld(overlayCtx.ctx, overlay, { ...view, overlay: true });
  assert.ok(overlayCtx.calls.includes('clearRect'), 'overlay mode starts from a transparent canvas');
  assert.equal(overlayCtx.frameFills.length, 0, 'overlay mode never paints over the whole frame');
  assert.ok(overlayCtx.calls.length < normalCtx.calls.length, 'overlay mode draws strictly less');
});


test('area hits are logged: per-block last-hit fields, a prop-hit log and an impact log, all capped', () => {
  const foreman = getCharacter('foreman');
  const world = createWorld(pageArea(), foreman, foreman.stats, 810);
  // A field of tough blocks so the Foreman keeps hitting without ever clearing them.
  addBreakables(world, Array.from({ length: 24 }, (_, i) => ({ ...block(-200 + (i % 6) * 80, -100 + Math.floor(i / 6) * 60, 1e6, i) })));

  for (let i = 0; i < 60 * 20; i += 1) stepWorld(world, 1 / 60, neutralInput);

  const hit = world.breakables.find((b) => b.lastHitAt !== undefined);
  assert.ok(hit, 'at least one block recorded a hit');
  assert.ok(hit.lastHitAt! > 0 && Number.isFinite(hit.lastHitX!) && Number.isFinite(hit.lastHitY!) && hit.lastDamage! >= 1);
  assert.ok(world.propHits.length > 0, 'prop hits were logged');
  assert.ok(world.impacts.length > 0, 'the meteor is large enough to log an impact');
  assert.ok(world.propHits.length <= PROP_HIT_CAP, 'an undrained prop-hit log cannot grow without bound');
  assert.ok(world.impacts.length <= IMPACT_CAP, 'an undrained impact log cannot grow without bound');
  for (const h of world.propHits) assert.ok(world.breakables.some((b) => b.uid === h.uid) || h.kill);
  for (const im of world.impacts) assert.ok(im.radius >= 24);
});

test('a projectile contact is too small to log as an impact, but still logs the block it hit', () => {
  const world = createWorld(pageArea([block(0, 0, 500, 1)]), pageCharacter(), CHARACTERS[0]!.stats, 812);
  world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;
  world.projectiles.push(shot(40));
  for (let i = 0; i < 12 && world.projectiles.length > 0; i += 1) stepWorld(world, 1 / 30, neutralInput);
  assert.equal(world.impacts.length, 0);
  assert.ok(world.propHits.length >= 1);
  assert.equal(world.propHits[0]!.uid, world.breakables[0]!.uid);
});

function wall(soft: boolean): ObstacleDef[] {
  const out: ObstacleDef[] = [];
  for (let y = -240; y <= 240; y += 40) out.push({ x: 0, y, w: 30, h: 40, kind: 'page-block', hp: 1e9, soft });
  return out;
}

test('enemies walk through soft page text but are stopped by a solid one', () => {
  const chase = (soft: boolean) => {
    const world = createWorld(pageArea(), pageCharacter(), CHARACTERS[0]!.stats, 811);
    world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;
    world.area.waves = [{ fromSec: 0, toSec: 600, enemyId: 'nightcrawler', ratePerSec: 4, burst: 1 }];
    addBreakables(world, wall(soft));
    world.player.x = 200;
    world.player.y = 0;
    world.player.hp = world.player.maxHp = 1e9;
    for (let i = 0; i < 240 && world.enemies.length === 0; i += 1) stepWorld(world, 1 / 60, neutralInput);
    const enemy = world.enemies[0]!;
    assert.ok(enemy, 'an enemy spawned');
    enemy.x = -120;
    enemy.y = 0;
    for (let i = 0; i < 60 * 4; i += 1) stepWorld(world, 1 / 60, neutralInput);
    return enemy.x;
  };
  assert.ok(chase(true) > 30, 'with a soft wall the chaser reaches the player side');
  assert.ok(chase(false) < -15, 'with a solid wall the same chaser is held back (control)');
});

test('the player is stopped by soft page text, but a dash carries him through it', () => {
  const play = (dash: boolean) => {
    const world = createWorld(pageArea(), pageCharacter(), CHARACTERS[0]!.stats, 813);
    world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;
    addBreakables(world, wall(true));
    world.player.x = -60;
    world.player.y = 0;
    if (dash) assert.equal(dashPlayer(world, 1, 0), true);
    for (let i = 0; i < 60 * 2; i += 1) stepWorld(world, 1 / 60, { moveX: 1, moveY: 0, ultimate: false });
    return world.player.x;
  };
  assert.ok(play(false) < -15, 'walking into soft text is blocked');
  assert.ok(play(true) > 15, 'dashing goes through it');
});
