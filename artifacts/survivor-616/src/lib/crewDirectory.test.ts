import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DIRECTORY } from './crewDirectory';

test("616's directory rows are valid and split into multiplayer and offline", () => {
  assert.ok(GAME_DIRECTORY.multiplayer().length >= 2);
  assert.ok(GAME_DIRECTORY.offline().length >= 1);
  assert.equal(GAME_DIRECTORY.find('party.board')?.invite, 'room');
  for (const row of GAME_DIRECTORY.all()) assert.match(row.route, /^\?screen=[a-z-]+$/);
});
