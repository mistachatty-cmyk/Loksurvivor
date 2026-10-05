import assert from 'node:assert/strict';
import test from 'node:test';

import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { WEAPONS_BY_ID } from '@/game/data/weapons';
import { renderWorld } from '@/game/render/draw';
import {
  addBreakables,
  createWorld,
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
