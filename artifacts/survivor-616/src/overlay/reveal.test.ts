import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BAND_ROWS,
  EDGE_NONE,
  EDGE_RIM,
  EDGE_SHADE,
  HoleField,
  fillWindow,
  packRgba,
  type EdgePalette,
} from './reveal';

const palette: EdgePalette = { rim: packRgba(10, 20, 30), shade: packRgba(1, 2, 3), scorch: packRgba(5, 5, 5, 120) };

test('a rect hole rounds OUTWARD to whole cells so no sliver of old content survives', () => {
  const f = new HoleField(100, 100);
  f.addRect(10.2, 20.7, 3.1, 2.2); // covers x 10.2..13.3, y 20.7..22.9
  for (let x = 10; x <= 13; x += 1) for (let y = 20; y <= 22; y += 1) assert.ok(f.isHole(x, y), `cell ${x},${y}`);
  assert.equal(f.isHole(9, 21), false);
  assert.equal(f.isHole(14, 21), false);
  assert.equal(f.isHole(11, 19), false);
  assert.equal(f.isHole(11, 23), false);
  assert.equal(f.holeCount, 4 * 3);
});

test('adding the same hole again changes nothing and reports no change', () => {
  const f = new HoleField(50, 50);
  assert.ok(f.addRect(5, 5, 4, 4));
  const v = f.version;
  assert.equal(f.addRect(5, 5, 4, 4), null);
  assert.equal(f.version, v, 'version only bumps on a real edit');
  assert.equal(f.holeCount, 16);
});

test('holes are clipped to the field and degenerate rects are ignored', () => {
  const f = new HoleField(20, 20);
  f.addRect(-5, -5, 8, 8);
  assert.ok(f.isHole(0, 0) && f.isHole(2, 2) && !f.isHole(3, 3));
  assert.equal(f.addRect(100, 100, 5, 5), null);
  assert.equal(f.addRect(3, 3, 0, 0), null);
  assert.equal(f.isHole(-1, 0), false);
  assert.equal(f.isHole(0, 999), false);
});

test('a circular crater is round, contains its centre, and is roughly pi r squared', () => {
  const f = new HoleField(200, 200);
  f.addCircle(100, 100, 20);
  assert.ok(f.isHole(100, 100));
  assert.ok(f.isHole(119, 100) && f.isHole(100, 119));
  assert.equal(f.isHole(100, 125), false);
  assert.equal(f.isHole(118, 118), false, 'the diagonal corner is outside a circle of r=20');
  const expected = Math.PI * 20.5 * 20.5;
  assert.ok(Math.abs(f.holeCount - expected) / expected < 0.06, `${f.holeCount} cells vs ~${Math.round(expected)}`);
});

test('a crater overlapping a rect hole only adds the new cells', () => {
  const f = new HoleField(200, 200);
  f.addRect(90, 90, 30, 30);
  const before = f.holeCount;
  f.addCircle(105, 105, 10);
  assert.equal(f.holeCount, before, 'a crater entirely inside an existing hole adds nothing');
  f.addCircle(120, 105, 10);
  assert.ok(f.holeCount > before);
});

test('bands are allocated lazily and a tall page costs only the bands that were touched', () => {
  const f = new HoleField(800, 12000);
  assert.equal(f.bandCount, 0);
  f.addRect(10, 5, 4, 4);
  assert.equal(f.bandCount, 1);
  f.addRect(10, BAND_ROWS * 7 + 3, 4, 4);
  assert.equal(f.bandCount, 2);
  assert.ok(f.isHole(11, BAND_ROWS * 7 + 4));
  assert.equal(f.isHole(11, BAND_ROWS * 3), false, 'an untouched band reads as empty without being allocated');
  assert.equal(f.bandCount, 2);
});

test('a hole straddling a band boundary is continuous', () => {
  const f = new HoleField(50, 1000);
  f.addRect(5, BAND_ROWS - 2, 3, 4);
  for (let y = BAND_ROWS - 2; y < BAND_ROWS + 2; y += 1) assert.ok(f.isHole(6, y), `row ${y}`);
  assert.equal(f.bandCount, 2);
});

test('edge kinds: rim outside a hole, shade inside under the top lip and left lip, none elsewhere', () => {
  const f = new HoleField(30, 30);
  f.addRect(10, 10, 5, 5);
  assert.equal(f.edgeKind(9, 12), EDGE_RIM);
  assert.equal(f.edgeKind(15, 12), EDGE_RIM);
  assert.equal(f.edgeKind(12, 9), EDGE_RIM);
  assert.equal(f.edgeKind(12, 15), EDGE_RIM);
  assert.equal(f.edgeKind(9, 9), EDGE_NONE, 'a diagonal neighbour is not a rim');
  assert.equal(f.edgeKind(12, 10), EDGE_SHADE, 'top row inside the hole');
  assert.equal(f.edgeKind(10, 12), EDGE_SHADE, 'left column inside the hole');
  assert.equal(f.edgeKind(12, 12), EDGE_NONE, 'deep inside');
  assert.equal(f.edgeKind(14, 14), EDGE_NONE, 'the bottom-right inside corner is lit');
  assert.equal(f.edgeKind(0, 0), EDGE_NONE);
});

test('two touching holes merge: there is no rim between them', () => {
  const f = new HoleField(40, 20);
  f.addRect(5, 5, 5, 5);
  f.addRect(10, 5, 5, 5);
  assert.equal(f.edgeKind(9, 7), EDGE_NONE);
  assert.equal(f.edgeKind(10, 7), EDGE_NONE);
});

test('scorch lands only on intact cells, thins with distance, is dithered and never lowers soot', () => {
  const f = new HoleField(100, 100);
  f.addCircle(50, 50, 6);
  const holes = f.holeCount;
  f.addScorch(50, 50, 14);
  assert.equal(f.holeCount, holes, 'soot never creates or removes holes');
  let near = 0, far = 0, nearCells = 0, farCells = 0;
  for (let y = 36; y <= 64; y += 1) for (let x = 36; x <= 64; x += 1) {
    if (f.isHole(x, y)) { assert.equal(f.scorchLevel(x, y), 0, 'no soot inside a hole'); continue; }
    const d = Math.hypot(x + 0.5 - 50, y + 0.5 - 50);
    if (d <= 14 * 0.5) { nearCells += 1; if (f.scorchLevel(x, y) > 0) near += 1; }
    else if (d <= 14) { farCells += 1; if (f.scorchLevel(x, y) > 0) far += 1; }
  }
  assert.ok(near / nearCells > far / farCells, 'denser close to the crater');
  assert.ok(near / nearCells < 1, 'dithered, so the page still shows through');
  const before = [f.scorchLevel(46, 50), f.scorchLevel(44, 50)];
  f.addScorch(50, 50, 6);
  assert.ok(f.scorchLevel(46, 50) >= before[0]! && f.scorchLevel(44, 50) >= before[1]!);
  assert.equal(f.addScorch(50, 50, 0), null);
});

test('a hole swallows any soot that was on that cell', () => {
  const f = new HoleField(60, 60);
  f.addScorch(30, 30, 10);
  let sooty: [number, number] | null = null;
  for (let y = 25; y < 36 && !sooty; y += 1) for (let x = 25; x < 36; x += 1) if (f.scorchLevel(x, y) > 0) { sooty = [x, y]; break; }
  assert.ok(sooty, 'some cell got soot');
  f.addRect(sooty![0], sooty![1], 1, 1);
  assert.equal(f.scorchLevel(sooty![0], sooty![1]), 0);
  assert.ok(f.isHole(sooty![0], sooty![1]));
});

test('fillWindow builds the mask and the edge layer for a window, and skips empty fields cheaply', () => {
  const f = new HoleField(50, 50);
  const w = 12, h = 12;
  const mask = new Uint32Array(w * h).fill(7);
  const edges = new Uint32Array(w * h).fill(7);
  assert.equal(fillWindow(f, 0, 0, w, h, mask, edges, palette), 0);
  assert.ok(mask.every((v) => v === 0) && edges.every((v) => v === 0), 'an empty field clears the buffers');

  f.addRect(4, 4, 4, 4);
  const inside = fillWindow(f, 0, 0, w, h, mask, edges, palette);
  assert.equal(inside, 16);
  assert.equal(mask[5 * w + 5], 0xffffffff);
  assert.equal(mask[2 * w + 2], 0);
  assert.equal(edges[5 * w + 3], palette.rim, 'rim just outside on the left');
  assert.equal(edges[4 * w + 5], palette.shade, 'inner shade on the top lip');
  assert.equal(edges[6 * w + 6], 0);
});

test('fillWindow follows the window origin (scroll) exactly: the same hole shifts by the offset', () => {
  const f = new HoleField(100, 100);
  f.addRect(40, 40, 6, 6);
  const w = 20, h = 20;
  const a = new Uint32Array(w * h), b = new Uint32Array(w * h), e = new Uint32Array(w * h);
  fillWindow(f, 35, 35, w, h, a, e, palette);
  fillWindow(f, 37, 36, w, h, b, e, palette);
  for (let y = 0; y < h - 1; y += 1) for (let x = 0; x < w - 2; x += 1) {
    assert.equal(b[y * w + x], a[(y + 1) * w + (x + 2)], `cell ${x},${y}`);
  }
});

test('eviction drops the farthest bands first and keeps the hole count honest', () => {
  const f = new HoleField(20, BAND_ROWS * 10);
  for (let band = 0; band < 6; band += 1) f.addRect(2, band * BAND_ROWS + 3, 2, 2);
  assert.equal(f.holeCount, 6 * 4);
  f.evict(0, 3);
  assert.equal(f.bandCount, 3);
  assert.ok(f.isHole(2, 3), 'the band we are standing in survives');
  assert.equal(f.isHole(2, 5 * BAND_ROWS + 3), false, 'the farthest band went first');
  assert.equal(f.holeCount, 3 * 4);
  f.clear();
  assert.equal(f.holeCount, 0);
  assert.equal(f.bandCount, 0);
});

test('packRgba produces the little-endian ABGR the canvas expects', () => {
  assert.equal(packRgba(255, 0, 0), 0xff0000ff);
  assert.equal(packRgba(0, 255, 0), 0xff00ff00);
  assert.equal(packRgba(0, 0, 255), 0xffff0000);
  assert.equal(packRgba(1, 2, 3, 4), 0x04030201);
});
