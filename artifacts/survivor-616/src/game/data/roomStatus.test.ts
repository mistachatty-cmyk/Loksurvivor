import test from 'node:test';
import assert from 'node:assert/strict';
import { bedroomStatus } from './roomStatus';
import { BEDROOM_616 } from './rooms616';
import { contractDayKey } from './contracts';

const meta = { unlockedCharacterIds: ['a', 'b'], savedLokPets: [1], bestiary: { x: 1, y: 2, z: 3 }, discoveryIds: [], clearedAreaIds: ['q'], cred: 90, lastLoginStreakDayKey: '', loginStreakCount: 0 } as never;

test('status counts come from the save and the stash alerts until claimed', () => {
  const now = Date.UTC(2026, 10, 23, 12);
  const s = bedroomStatus(meta, now);
  assert.equal(s.roster?.count, 2);
  assert.equal(s.bestiary?.count, 3);
  assert.equal(s.stash?.alert, true);
  const claimed = bedroomStatus({ ...(meta as object), lastLoginStreakDayKey: contractDayKey(now), loginStreakCount: 4 } as never, now);
  assert.equal(claimed.stash?.alert, false);
  assert.equal(claimed.stash?.count, 4);
});

test('every status key is a real bedroom object', () => {
  const ids = new Set(BEDROOM_616.anchors.map((a) => a.id));
  for (const k of Object.keys(bedroomStatus(meta))) assert.ok(ids.has(k), k);
});
