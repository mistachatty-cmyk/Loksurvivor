import assert from 'node:assert/strict';
import test from 'node:test';
import { CUSTOM_SLOTS, ENDGAME_FEATURES, ENDGAME_UNLOCK_TABLE } from './data/endgameUnlocks';

test('the unlock table lists every feature and slot with how and why', () => {
  const ids = new Set(ENDGAME_UNLOCK_TABLE.map((row) => row.id));
  assert.equal(ids.size, ENDGAME_UNLOCK_TABLE.length, 'ids are unique');
  for (const f of ENDGAME_FEATURES) assert.ok(ids.has(f.id), f.id);
  for (const s of CUSTOM_SLOTS) assert.ok(ids.has(s.id), s.id);
  for (const row of ENDGAME_UNLOCK_TABLE) {
    assert.ok(row.how.length > 10 && row.why.length > 10, row.id);
    assert.doesNotMatch(`${row.name} ${row.how} ${row.why}`, new RegExp(['sig', 'nal'].join(''), 'i'));
  }
});

test('nothing in the table is open on a fresh save', () => {
  const fresh = { clearedAreaIds: [], totalKills: 0, rescuedAllyIds: [], discoveryIds: [], lokPetBattleWins: 0 };
  assert.ok(ENDGAME_UNLOCK_TABLE.every((row) => !row.open(fresh)));
});
