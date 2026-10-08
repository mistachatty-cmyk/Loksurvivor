import assert from 'node:assert/strict';
import test from 'node:test';

import { ENEMY_QUIRKS } from '@/game/data/enemyQuirks';
import { QUIRK_STORAGE_KEY, disabledQuirkIds, isQuirkEnabled, setAllQuirksEnabled, setQuirkEnabled } from './quirkStore';

function installStorage() {
  const data = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
  return data;
}

test('every quirk starts on, can be switched individually, and all at once', () => {
  const data = installStorage();
  assert.deepEqual(disabledQuirkIds(), []);
  setQuirkEnabled('volatile', false);
  assert.equal(isQuirkEnabled('volatile'), false);
  assert.equal(isQuirkEnabled('gilded'), true);
  setQuirkEnabled('volatile', true);
  assert.deepEqual(disabledQuirkIds(), []);
  setAllQuirksEnabled(false);
  assert.equal(disabledQuirkIds().length, ENEMY_QUIRKS.length);
  setAllQuirksEnabled(true);
  assert.deepEqual(disabledQuirkIds(), []);
  data.set(QUIRK_STORAGE_KEY, '["nope","flicker",5]');
  assert.deepEqual(disabledQuirkIds(), ['flicker']);
  data.set(QUIRK_STORAGE_KEY, 'not json');
  assert.deepEqual(disabledQuirkIds(), []);
});
