import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextInDirection } from './consolePad.ts';

test('picks the nearest control in the pressed direction', () => {
  const others = [{ x: 100, y: 0 }, { x: 300, y: 0 }, { x: 0, y: 80 }];
  assert.equal(nextInDirection({ x: 0, y: 0 }, others, 'right'), 0);
  assert.equal(nextInDirection({ x: 0, y: 0 }, others, 'down'), 2);
  assert.equal(nextInDirection({ x: 0, y: 0 }, others, 'up'), -1);
});
