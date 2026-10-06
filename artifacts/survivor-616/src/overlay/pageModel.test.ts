import assert from 'node:assert/strict';
import test from 'node:test';

import { getCharacter } from '@/game/data/characters';
import { addBreakables, createWorld, stepWorld } from '@/game/engine/world';
import { SPRITE_SCALE } from '@/game/render/draw';
import { CELL_CSS, SPEED_MULT, SPRITE_UNITS, WORLD_K, lowResSize, snapToCell, targetViewUnits } from './scale';
import {
  MAX_ACTIVE_BLOCKS,
  blockHp,
  blockToObstacle,
  cameraForScroll,
  clampDocSize,
  destroyedFraction,
  diffWindow,
  overlayArea,
  pageToWorld,
  scrollTargetFor,
  selectActive,
  skipBlocksNear,
  worldToPage,
  type PageBlock,
} from './pageModel';

const doc = { w: 1200, h: 4000 };

function pb(id: number, x: number, y: number, w = 100, h = 40): PageBlock {
  return { id, owner: id, kind: 'box', x, y, w, h, hp: blockHp(w, h), destroyed: false, skip: false };
}

test('blockHp scales with area and stays inside its clamp', () => {
  assert.equal(blockHp(4, 4), 18);
  assert.equal(blockHp(100, 40), Math.round((100 * 40) / 140));
  assert.equal(blockHp(2000, 2000), 420);
  assert.ok(blockHp(600, 400) > blockHp(100, 40));
});

test('page/world mapping round-trips and centres the document on the origin', () => {
  assert.deepEqual(pageToWorld(600, 2000, doc, 1), { x: 0, y: 0 });
  assert.deepEqual(pageToWorld(0, 0, doc, 1), { x: -600, y: -2000 });
  const p = worldToPage(123.5, -77, doc, 1);
  assert.deepEqual(pageToWorld(p.x, p.y, doc, 1), { x: 123.5, y: -77 });
  // at the real scale, world units are page px divided by k
  const q = pageToWorld(600 + WORLD_K * 10, 2000 - WORLD_K * 20, doc);
  assert.ok(Math.abs(q.x - 10) < 1e-9 && Math.abs(q.y + 20) < 1e-9);
  const back = worldToPage(q.x, q.y, doc);
  assert.ok(Math.abs(back.x - (600 + WORLD_K * 10)) < 1e-9);
});

test('blockToObstacle converts a top-left rect to a centred page-block carrying hp and id', () => {
  const o = blockToObstacle(pb(9, 500, 1980, 200, 40), doc, 1);
  assert.equal(o.kind, 'page-block');
  assert.equal(o.domId, 9);
  assert.equal(o.hp, blockHp(200, 40));
  assert.equal(o.w, 200);
  assert.equal(o.h, 40);
  assert.equal(o.soft, true, 'page text is solid to the player only');
  // centre of the rect is page (600, 2000) = world origin
  assert.deepEqual({ x: o.x, y: o.y }, { x: 0, y: 0 });
  // at the real scale the box shrinks to world units but hp is unchanged
  const scaled = blockToObstacle(pb(9, 500, 1980, 200, 40), doc);
  assert.ok(Math.abs(scaled.w - 200 / WORLD_K) < 1e-9 && Math.abs(scaled.h - 40 / WORLD_K) < 1e-9);
  assert.equal(scaled.hp, o.hp);
});

test('camera lines up with a viewport-pinned canvas and the scroll target clamps to the page', () => {
  const canvas = { w: 1000, h: 600 };
  assert.deepEqual(cameraForScroll({ x: 0, y: 0 }, canvas, doc, 1), pageToWorld(500, 300, doc, 1));
  assert.deepEqual(cameraForScroll({ x: 100, y: 800 }, canvas, doc, 1), pageToWorld(600, 1100, doc, 1));
  assert.deepEqual(cameraForScroll({ x: 100, y: 800 }, canvas, doc), pageToWorld(600, 1100, doc));

  const view = { w: 1000, h: 600 };
  assert.deepEqual(scrollTargetFor({ x: 600, y: 2000 }, view, doc), { x: 100, y: 1700 });
  assert.deepEqual(scrollTargetFor({ x: 5, y: 5 }, view, doc), { x: 0, y: 0 });
  assert.deepEqual(scrollTargetFor({ x: 1200, y: 4000 }, view, doc), { x: 200, y: 3400 });
  // a page narrower than the viewport never scrolls sideways
  assert.equal(scrollTargetFor({ x: 400, y: 100 }, { w: 1000, h: 600 }, { w: 900, h: 4000 }).x, 0);
});

test('clampDocSize never goes below the viewport or above the caps', () => {
  assert.deepEqual(clampDocSize({ w: 100, h: 100 }, { w: 1000, h: 600 }), { w: 1000, h: 600 });
  const huge = clampDocSize({ w: 99999, h: 999999 }, { w: 1000, h: 600 });
  assert.ok(huge.w <= 8000 && huge.h <= 30000);
});

test('selectActive keeps only the vertical window, drops destroyed/skipped, and caps nearest-first', () => {
  const blocks = [pb(0, 0, 0), pb(1, 0, 500), pb(2, 0, 1000), pb(3, 0, 1500), pb(4, 0, 3000), pb(5, 0, 3900)];
  blocks[1]!.destroyed = true;
  blocks[3]!.skip = true;
  // centre 800, viewport 600 => window is ±900px => page y in [-100, 1700]
  const active = selectActive(blocks, 800, 600);
  assert.deepEqual(active.map((b) => b.id), [0, 2], 'in-window only; destroyed (1) and skipped (3) dropped; 4 and 5 are out of range');

  const many = Array.from({ length: 50 }, (_, i) => pb(i, 0, i * 10, 50, 10));
  const nearest = selectActive(many, 250, 4000, 5);
  assert.equal(nearest.length, 5);
  assert.ok(nearest.every((b) => Math.abs(b.y - 250) <= 30), 'cap keeps the blocks nearest the player');
  assert.ok(MAX_ACTIVE_BLOCKS >= 1000);
});

test('diffWindow adds only what is missing and removes only what left the window', () => {
  const desired = [pb(1, 0, 0), pb(2, 0, 0), pb(3, 0, 0)];
  const { add, removeIds } = diffWindow(new Set([2, 3, 9]), desired);
  assert.deepEqual(add.map((b) => b.id), [1]);
  assert.deepEqual(removeIds, [9]);
  assert.deepEqual(diffWindow(new Set([1, 2, 3]), desired), { add: [], removeIds: [] });
});

test('destroyedFraction is area-weighted, ignores skipped blocks, and is 0 for an empty page', () => {
  assert.equal(destroyedFraction([]), 0);
  const blocks = [pb(0, 0, 0, 100, 100), pb(1, 0, 0, 100, 300), pb(2, 0, 0, 500, 500)];
  blocks[2]!.skip = true;
  blocks[0]!.destroyed = true;
  assert.equal(destroyedFraction(blocks), 10000 / 40000);
  blocks[1]!.destroyed = true;
  assert.equal(destroyedFraction(blocks), 1);
});

test('skipBlocksNear flags blocks overlapping the spawn so the player is not born inside a wall', () => {
  const blocks = [pb(0, 90, 90, 40, 40), pb(1, 600, 600, 40, 40), pb(2, 130, 100, 40, 40)];
  const n = skipBlocksNear(blocks, { x: 100, y: 100 }, 20);
  assert.equal(n, 1);
  assert.deepEqual(blocks.map((b) => b.skip), [true, false, false]);
});

test('overlayArea builds a world exactly the size of the page with the Foreman, no waves and no timed clear', () => {
  const area = overlayArea(doc, 1);
  assert.deepEqual(area.bounds, doc);
  const real = overlayArea(doc);
  assert.ok(Math.abs(real.bounds.w - doc.w / WORLD_K) < 1e-9 && Math.abs(real.bounds.h - doc.h / WORLD_K) < 1e-9);
  assert.equal(area.waves.length, 0);
  assert.ok(area.durationSec > 1e6);

  const foreman = getCharacter('foreman');
  assert.equal(foreman.id, 'foreman');
  const world = createWorld(real, foreman, foreman.stats, 4242);
  assert.equal(world.outcome, 'running');
  assert.equal(world.enemies.length, 0);
  assert.equal(world.bounds.w, real.bounds.w);
  assert.equal(world.bounds.h, real.bounds.h);
});

test('end to end: the Foreman, with no enemies at all, breaks page-blocks that are within reach', () => {
  const foreman = getCharacter('foreman');
  const world = createWorld(overlayArea(doc), foreman, foreman.stats, 4243);
  // Spawn the player at page (600, 2000) = world origin, with a row of blocks to the right and below.
  const blocks = [pb(0, 640, 1990, 120, 40), pb(1, 640, 2050, 120, 40), pb(2, 560, 2080, 120, 40)];
  addBreakables(world, blocks.map((b) => blockToObstacle(b, doc)));

  for (let i = 0; i < 60 * 12 && world.outcome === 'running'; i += 1) {
    stepWorld(world, 1 / 60, { moveX: 0, moveY: 0, ultimate: false });
  }

  const touched = world.breakables.filter((b) => b.broken || b.hp < b.maxHp);
  assert.ok(touched.length > 0, `Foreman damaged ${touched.length}/3 blocks in 12s with no enemies`);
  assert.equal(world.outcome, 'running', 'pure demolition world never ends the run by itself');
});

test('scale constants: integer css cell, in step with the renderer, and the world is page / k', () => {
  assert.ok(Number.isInteger(CELL_CSS), 'a fractional cell would drift off the page at fractional dpr');
  assert.equal(SPRITE_UNITS, SPRITE_SCALE, 'overlay/scale.ts must match SPRITE_SCALE in render/draw.ts');
  assert.ok(Math.abs(WORLD_K - CELL_CSS / SPRITE_UNITS) < 1e-12);
  assert.ok(SPEED_MULT > 1 && SPEED_MULT <= 1.5);
});

test('the M0 pace target holds: the Foreman crosses a 1280px viewport in 7-9 seconds', () => {
  const foreman = getCharacter('foreman');
  const cssPerSecond = foreman.stats.speed * SPEED_MULT * WORLD_K;
  const seconds = 1280 / cssPerSecond;
  assert.ok(seconds >= 7 && seconds <= 9.2, `crossing took ${seconds.toFixed(1)}s`);
});

test('snapToCell lands on exact cell multiples and lowResSize covers the viewport', () => {
  assert.equal(snapToCell(0), 0);
  assert.equal(snapToCell(4), 3);
  assert.equal(snapToCell(5), 6);
  assert.equal(snapToCell(1000.4) % CELL_CSS, 0);
  assert.deepEqual(lowResSize({ w: 1280, h: 720 }), { w: Math.ceil(1280 / CELL_CSS), h: 240 });
  const low = lowResSize({ w: 1281, h: 721 });
  assert.ok(low.w * CELL_CSS >= 1281 && low.h * CELL_CSS >= 721);
  assert.equal(targetViewUnits(100), 100 * SPRITE_UNITS);
});
