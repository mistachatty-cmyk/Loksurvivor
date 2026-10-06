import assert from 'node:assert/strict';
import test from 'node:test';

import { clipPathFor, mergeHoles } from './hider';
import { CHUNK_WIDTH, chunkLine } from './scanner';

test('mergeHoles joins touching holes on the same row and leaves other rows alone', () => {
  const merged = mergeHoles([
    { x: 100, y: 50, w: 40, h: 20 },
    { x: 0, y: 50, w: 40, h: 20 },
    { x: 40, y: 50, w: 60, h: 20 }, // bridges the two above
    { x: 0, y: 80, w: 40, h: 20 },
    { x: 300, y: 50, w: 10, h: 20 }, // same row but a gap away
  ]);
  assert.deepEqual(merged, [
    { x: 0, y: 50, w: 140, h: 20 },
    { x: 300, y: 50, w: 10, h: 20 },
    { x: 0, y: 80, w: 40, h: 20 },
  ]);
});

test('mergeHoles does not mutate its input', () => {
  const input = [{ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }];
  mergeHoles(input);
  assert.deepEqual(input, [{ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }]);
});

test('clipPathFor pads the box and punches holes in element-relative coordinates', () => {
  const css = clipPathFor({ x: 200, y: 400, w: 300, h: 100 }, [{ x: 220, y: 410, w: 50, h: 20 }]);
  assert.ok(css.startsWith('path(evenodd, "') && css.endsWith('")'));
  // outer padded rectangle, then the hole at (20,10) size 50x20
  assert.ok(css.includes('M-48 -48H348V148H-48Z'), css);
  assert.ok(css.includes('M20 10H70V30H20Z'), css);
});

test('clipPathFor with no holes is just the padded box', () => {
  assert.equal(clipPathFor({ x: 0, y: 0, w: 10, h: 10 }, []), 'path(evenodd, "M-48 -48H58V58H-48Z")');
});

test('chunkLine splits long lines into word-sized pieces that tile the line exactly', () => {
  const line = { x: 10, y: 30, w: 500, h: 22 };
  const chunks = chunkLine(line);
  assert.equal(chunks.length, Math.round(500 / CHUNK_WIDTH));
  assert.equal(chunks[0]!.x, 10);
  const last = chunks[chunks.length - 1]!;
  assert.ok(Math.abs(last.x + last.w - 510) < 1e-9, 'chunks end where the line ends');
  for (let i = 1; i < chunks.length; i += 1) {
    assert.ok(Math.abs(chunks[i]!.x - (chunks[i - 1]!.x + chunks[i - 1]!.w)) < 1e-9, 'no gaps or overlaps');
  }
  assert.ok(chunks.every((c) => c.y === 30 && c.h === 22));
});

test('chunkLine keeps a short line as a single block', () => {
  assert.deepEqual(chunkLine({ x: 0, y: 0, w: 60, h: 20 }), [{ x: 0, y: 0, w: 60, h: 20 }]);
});
