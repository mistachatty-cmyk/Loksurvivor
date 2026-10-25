import assert from 'node:assert/strict';
import test from 'node:test';

import { newSince } from './inventorySeen';

test('nothing is new on the first visit', () => {
  assert.deepEqual(newSince({ pack: 3, cred: 50 }, null), {});
});

test('only counts that grew are reported, including brand new entries', () => {
  assert.deepEqual(newSince({ pack: 5, cred: 40, gem: 2, same: 7 }, { pack: 3, cred: 90, same: 7 }), { pack: 2, gem: 2 });
});
