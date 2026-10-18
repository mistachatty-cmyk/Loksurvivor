import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createInitialMeta } from '@/game/state/metaStore';
import { ACHIEVEMENT_LEDGER_KEY, completeAchievementIds, readLedger, syncAchievementLedger, type LedgerStorage } from './lokAchievements';

function memoryStorage(initial: Record<string, string> = {}): LedgerStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (key) => data[key] ?? null, setItem: (key, value) => void (data[key] = value) };
}

test('the first ledger records what is already complete as date-unknown, not "just now"', () => {
  const meta = { ...createInitialMeta(), totalKills: 5 };
  assert.ok(completeAchievementIds(meta).includes('first-blood'));
  const storage = memoryStorage();
  const ledger = syncAchievementLedger(meta, storage, 1_000);
  assert.equal(ledger['first-blood'], null);
  assert.deepEqual(readLedger(storage), ledger);
});

test('later completions are stamped with the time and existing entries never change', () => {
  const storage = memoryStorage();
  syncAchievementLedger({ ...createInitialMeta(), totalKills: 5 }, storage, 1_000);
  const later = syncAchievementLedger({ ...createInitialMeta(), totalKills: 5000 }, storage, 9_000);
  assert.equal(later['first-blood'], null); // untouched
  assert.equal(later['body-count-1000'], 9_000); // newly earned, real time
  const again = syncAchievementLedger({ ...createInitialMeta(), totalKills: 5000 }, storage, 99_999);
  assert.deepEqual(again, later);
});

test('an empty first ledger is still saved, so the next completion gets a real date', () => {
  const storage = memoryStorage();
  syncAchievementLedger(createInitialMeta(), storage, 1_000);
  assert.equal(storage.data[ACHIEVEMENT_LEDGER_KEY], '{}');
  const next = syncAchievementLedger({ ...createInitialMeta(), totalKills: 1 }, storage, 2_000);
  assert.equal(next['first-blood'], 2_000);
});

test('a corrupt stored ledger is treated as absent', () => {
  const storage = memoryStorage({ [ACHIEVEMENT_LEDGER_KEY]: '[1,2' });
  assert.equal(readLedger(storage), null);
});
