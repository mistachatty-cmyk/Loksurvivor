import { test } from 'node:test';
import assert from 'node:assert/strict';
import { press } from './press';

test('a party button fires once per tap and once per keyboard press', () => {
  let n = 0;
  const h = press(() => (n += 1));
  h.onPointerDown({ preventDefault() {} });
  h.onClick({ detail: 1 }); // the click that follows the tap
  assert.equal(n, 1);
  h.onClick({ detail: 0 }); // Enter or Space on a focused button
  assert.equal(n, 2);
});
