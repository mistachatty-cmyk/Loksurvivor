import assert from 'node:assert/strict';
import test from 'node:test';

import { createInitialMeta, normalizeMeta, reducer } from '@/game/state/metaStore';

test('a fresh save has no revealed stats recorded', () => {
  assert.deepEqual(createInitialMeta().revealedStats, {});
});

test('normalizeMeta keeps well-formed revealedStats and coerces bad values to 0', () => {
  const loaded = normalizeMeta({
    version: 1,
    revealedStats: { cred: 250, 'bestiary:bat': 17, negative: -5, notANumber: 'x' },
  });
  assert.deepEqual(loaded.revealedStats, { cred: 250, 'bestiary:bat': 17, negative: 0, notANumber: 0 });
});

test('normalizeMeta ignores a non-object revealedStats and caps absurd key lengths/counts', () => {
  assert.deepEqual(normalizeMeta({ version: 1, revealedStats: 'nope' }).revealedStats, {});
  assert.deepEqual(normalizeMeta({ version: 1, revealedStats: null }).revealedStats, {});

  const tooLongKey = 'x'.repeat(500);
  const manyEntries = Object.fromEntries(
    Array.from({ length: 600 }, (_, i) => [`key-${i}`, i]),
  );
  const loaded = normalizeMeta({
    version: 1,
    revealedStats: { ...manyEntries, [tooLongKey]: 1 },
  });
  assert.ok(!(tooLongKey in loaded.revealedStats), 'an absurdly long key must be dropped');
  assert.ok(Object.keys(loaded.revealedStats).length <= 500, 'the ledger must be bounded');
});

test('revealStat records a stat catching up and is a no-op once already caught up', () => {
  let state = { meta: createInitialMeta(), lastRun: null };
  state = reducer(state, { type: 'revealStat', key: 'cred', value: 250 });
  assert.equal(state.meta.revealedStats.cred, 250);

  const settled = reducer(state, { type: 'revealStat', key: 'cred', value: 250 });
  assert.equal(settled, state, 'revealing an already-revealed value must not produce a new state object');

  const advanced = reducer(state, { type: 'revealStat', key: 'cred', value: 900 });
  assert.equal(advanced.meta.revealedStats.cred, 900);
});
