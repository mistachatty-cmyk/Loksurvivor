import assert from 'node:assert/strict';
import test from 'node:test';

import { CellGrid } from '@/game/engine/cellGrid';

test('CellGrid groups items by key and survives growth', () => {
  const grid = new CellGrid<number>(2);
  for (let i = 0; i < 5000; i += 1) grid.add((i % 700) * 4096 + (i % 13), i);
  const seen = new Map<number, number[]>();
  for (let i = 0; i < 5000; i += 1) {
    const key = (i % 700) * 4096 + (i % 13);
    const list = seen.get(key) ?? [];
    list.push(i);
    seen.set(key, list);
  }
  assert.equal(grid.size, seen.size);
  for (const [key, expected] of seen) assert.deepEqual(grid.get(key), expected);
  assert.equal(grid.get(123456789), undefined);
});

test('CellGrid.clear empties the grid and recycles buckets', () => {
  const grid = new CellGrid<string>();
  grid.add(7, 'a');
  grid.add(7, 'b');
  const first = grid.get(7);
  grid.clear();
  assert.equal(grid.size, 0);
  assert.equal(grid.get(7), undefined);
  grid.add(9, 'c');
  assert.equal(grid.get(9), first, 'bucket arrays are reused after clear');
  assert.deepEqual(grid.get(9), ['c']);
  let cells = 0;
  grid.forEachCell(() => { cells += 1; });
  assert.equal(cells, 1);
});
