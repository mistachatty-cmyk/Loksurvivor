import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COMBO_MILESTONES,
  COMBO_WINDOW_MS,
  DEBRIS_CAP,
  FLOATER_MERGE_MS,
  HIT_STOP_MAX_MS,
  addFloater,
  comboAlive,
  comboBreak,
  crackCells,
  crackStage,
  damageNumberText,
  dissolveDone,
  dissolveLevel,
  hitStopMs,
  newCombo,
  pruneFloaters,
  spawnDebris,
  stepDebris,
  type Debris,
  type Floater,
} from './fx';
import { GLYPH_H, GLYPH_W, hasGlyph, measureText, textCells } from './pixelFont';
import { addOutline, binariseAlpha } from './pixelPass';
import { BAYER4, HoleField } from './reveal';
import { createRng } from '@/game/engine/math';

test('crack stages follow the 66 / 33 / 15 percent thresholds', () => {
  assert.equal(crackStage(1), 0);
  assert.equal(crackStage(0.7), 0);
  assert.equal(crackStage(0.66), 1);
  assert.equal(crackStage(0.4), 1);
  assert.equal(crackStage(0.3), 2);
  assert.equal(crackStage(0.1), 3);
  assert.equal(crackStage(-1), 3);
});

test('cracks are deterministic per block, grow by stage without moving, and stay inside the block', () => {
  const a = crackCells(77, 30, 12, 1);
  assert.deepEqual(a, crackCells(77, 30, 12, 1));
  assert.notDeepEqual(a, crackCells(78, 30, 12, 1));
  const c = crackCells(77, 30, 12, 3);
  assert.ok(c.length > a.length);
  for (const cell of a) assert.ok(c.some((o) => o[0] === cell[0] && o[1] === cell[1]), 'earlier stage cells survive');
  for (const [x, y] of c) assert.ok(x >= 0 && y >= 0 && x < 30 && y < 12);
  assert.deepEqual(crackCells(1, 30, 12, 0), []);
  assert.deepEqual(crackCells(1, 2, 2, 3), [], 'tiny blocks do not crack');
});

test('a dissolve flashes first, then opens in four monotone steps and finishes', () => {
  assert.equal(dissolveLevel(0), 0);
  assert.equal(dissolveLevel(49), 0);
  const levels = [60, 130, 190, 250, 400].map(dissolveLevel);
  assert.deepEqual(levels, [4, 8, 12, 16, 16]);
  assert.equal(dissolveDone(100), false);
  assert.equal(dissolveDone(250), true);
});

test('dither steps nest: each level opens a superset of the last and level 16 opens the whole rect', () => {
  const f = new HoleField(40, 40);
  let last = 0;
  for (const level of [4, 8, 12, 16]) {
    f.addDither(4, 4, 16, 8, level);
    assert.ok(f.holeCount > last, `level ${level} opened more cells`);
    last = f.holeCount;
  }
  assert.equal(f.holeCount, 16 * 8);
  assert.equal(f.addDither(4, 4, 16, 8, 0), null);
  assert.equal(BAYER4.length, 16);
});

test('hit-stop needs a big block, scales with it, and never passes 60 ms', () => {
  assert.equal(hitStopMs(18, 3), 0);
  assert.ok(hitStopMs(100, 1) > 0 && hitStopMs(420, 5) <= HIT_STOP_MAX_MS);
  assert.ok(hitStopMs(300, 2) >= hitStopMs(60, 2));
  assert.equal(hitStopMs(1e9, 99), HIT_STOP_MAX_MS);
});

test('combo builds inside the window, resets after it, and reports each milestone once', () => {
  const s = newCombo();
  const milestones: number[] = [];
  let t = 0;
  for (let i = 0; i < 30; i += 1) {
    t += 300;
    const m = comboBreak(s, t);
    if (m !== null) milestones.push(m);
  }
  assert.deepEqual(milestones, [10, 25]);
  assert.equal(s.count, 30);
  assert.equal(comboAlive(s, t + COMBO_WINDOW_MS), 30);
  assert.equal(comboAlive(s, t + COMBO_WINDOW_MS + 1), 0);
  comboBreak(s, t + 5000);
  assert.equal(s.count, 1, 'a long gap starts a fresh combo');
  assert.equal(s.best, 30, 'the best is remembered');
  assert.ok(COMBO_MILESTONES.length >= 4);
});

test('damage numbers merge per block inside 120 ms, split after it, and expire', () => {
  const list: Floater[] = [];
  addFloater(list, 5, 10, 10, 12, false, 1000);
  addFloater(list, 5, 10, 10, 8, true, 1000 + FLOATER_MERGE_MS - 1);
  assert.equal(list.length, 1);
  assert.equal(list[0]!.text, '20');
  assert.equal(list[0]!.kill, true);
  addFloater(list, 5, 10, 10, 3, false, 1000 + FLOATER_MERGE_MS + 5);
  assert.equal(list.length, 2);
  addFloater(list, 6, 1, 1, 4, false, 1001);
  assert.equal(list.length, 3);
  pruneFloaters(list, 5000);
  assert.equal(list.length, 0);
  assert.equal(damageNumberText(12.6), '13');
  assert.equal(damageNumberText(25400), '25K');
});

test('debris flies away from the hit, slows down, dies, and is capped', () => {
  const rng = createRng(3);
  const out: Debris[] = [];
  spawnDebris(out, rng, { x: 100, y: 100, w: 20, h: 6 }, { x: 80, y: 103 }, ['#fff', '#aaa'], 12);
  assert.equal(out.length, 12);
  const movingAway = out.filter((d) => d.vx > 0).length;
  assert.ok(movingAway >= 9, `${movingAway}/12 moved away from a hit on the left`);
  const x0 = out[0]!.x;
  stepDebris(out, 0.1);
  assert.notEqual(out[0]!.x, x0);
  for (let i = 0; i < 20; i += 1) stepDebris(out, 0.1);
  assert.equal(out.length, 0, 'everything has faded after two seconds');
  for (let i = 0; i < 40; i += 1) spawnDebris(out, rng, { x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5 }, ['#fff'], 30);
  assert.ok(out.length <= DEBRIS_CAP);
});

test('pixel font: every digit exists, text measures in cells, unknown characters are blank', () => {
  for (const ch of '0123456789x!') assert.ok(hasGlyph(ch), ch);
  assert.equal(measureText('12'), GLYPH_W * 2 + 1);
  const cells = textCells('8');
  assert.equal(cells.length, 13, 'an 8 lights 13 of 15 cells');
  for (const [x, y] of cells) assert.ok(x < GLYPH_W && y < GLYPH_H);
  assert.deepEqual(textCells('~'), []);
  const two = textCells('11');
  assert.ok(two.some(([x]) => x >= GLYPH_W + 1), 'the second glyph is offset by width + gap');
});

test('pixelPass binarises alpha and outlines silhouettes without chaining', () => {
  const px = new Uint32Array(9);
  px[4] = 0x80123456; // alpha 128 -> opaque
  px[1] = 0x7f654321; // alpha 127 -> gone
  assert.equal(binariseAlpha(px), 1);
  assert.equal(px[4], 0xff123456);
  assert.equal(px[1], 0);
  const added = addOutline(px, 3, 3, 0xff000000);
  assert.equal(added, 4, 'only the 4-neighbours of the one opaque pixel');
  assert.equal(px[0], 0, 'diagonals are not outlined');
  assert.equal(px[1], 0xff000000);
});
