import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createSaveGuard } from './saveGuard';

test('a clean tab writes freely, even after another tab saved, until it has something to write', () => {
  const guard = createSaveGuard(() => true);
  assert.equal(guard.requestWrite(), true);
  guard.noteForeignWrite();
  assert.equal(guard.isBehind(), false, 'an idle tab shows nothing');
});

test('a write attempt after another tab saved pauses until the player chooses', () => {
  const guard = createSaveGuard(() => true);
  let calls = 0;
  guard.subscribe(() => { calls += 1; });
  guard.noteForeignWrite();
  assert.equal(guard.requestWrite(), false);
  assert.equal(guard.requestWrite(), false);
  assert.equal(guard.isBehind(), true);
  assert.equal(calls, 1, 'asked once, not on every attempt');
  guard.resolve();
  assert.equal(calls, 2);
  assert.equal(guard.requestWrite(), true);
});

test('turning the guard off never blocks a write', () => {
  let on = true;
  const guard = createSaveGuard(() => on);
  guard.noteForeignWrite();
  on = false;
  assert.equal(guard.requestWrite(), true);
  assert.equal(guard.isBehind(), false);
});
