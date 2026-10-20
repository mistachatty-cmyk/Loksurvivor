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

test('Everywhere and Take it on are ignored until their kill counts are reached', async () => {
  installStorage();
  const { QUIRK_EVERYWHERE_KILLS, QUIRK_TAKE_ON_KILLS } = await import('@/game/data/enemyQuirks');
  const { earnedQuirkRunSetup, quirkUnlocks, setQuirkEverywhere, setQuirkTaken } = await import('./quirkStore');
  assert.deepEqual(quirkUnlocks(0), { everywhere: false, taken: false });
  assert.deepEqual(quirkUnlocks(QUIRK_EVERYWHERE_KILLS), { everywhere: true, taken: false });
  assert.deepEqual(quirkUnlocks(QUIRK_TAKE_ON_KILLS), { everywhere: true, taken: true });
  setQuirkEverywhere('volatile', true);
  setQuirkTaken('volatile', true);
  setQuirkEverywhere('gilded', true);
  assert.deepEqual(earnedQuirkRunSetup({}), { disabledIds: [], everywhereIds: [], takenIds: [] });
  const mid = earnedQuirkRunSetup({ volatile: QUIRK_EVERYWHERE_KILLS, gilded: QUIRK_EVERYWHERE_KILLS });
  assert.deepEqual(mid.everywhereIds.sort(), ['gilded', 'volatile']);
  assert.deepEqual(mid.takenIds, []);
  assert.deepEqual(earnedQuirkRunSetup({ volatile: QUIRK_TAKE_ON_KILLS }).takenIds, ['volatile']);
  assert.deepEqual(earnedQuirkRunSetup({}, true).takenIds, ['volatile']);
});

test('the first version of the save (a plain list of switched-off quirks) still loads', () => {
  const data = installStorage();
  data.set(QUIRK_STORAGE_KEY, '["flicker"]');
  assert.deepEqual(disabledQuirkIds(), ['flicker']);
});
