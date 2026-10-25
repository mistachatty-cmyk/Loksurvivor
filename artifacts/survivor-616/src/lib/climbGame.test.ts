import assert from 'node:assert/strict';
import { test } from 'node:test';

import { advanceClimb, createClimb, hazardInRow, hazardsAround, slideSpeed } from './climbGame';

const STEP = 1 / 60;

test('a climber who never leaps slides off the bottom', () => {
  const game = createClimb(7, 240);
  let fell = false;
  for (let i = 0; i < 60 * 12 && !fell; i += 1) fell = advanceClimb(game, STEP, false).fell;
  assert.ok(fell);
});

test('leaping from wall to wall climbs', () => {
  const game = createClimb(7, 240);
  for (let i = 0; i < 60 * 6; i += 1) {
    // Press as soon as the climber is holding a wall.
    advanceClimb(game, STEP, game.clinging !== null);
  }
  assert.ok(-game.bestY > 250, `climbed ${-game.bestY}`);
});

test('a leap crosses the shaft and lands on the other wall', () => {
  const game = createClimb(7, 240);
  advanceClimb(game, STEP, true);
  assert.equal(game.clinging, null);
  let guard = 0;
  while (game.clinging === null && guard < 200) { advanceClimb(game, STEP, false); guard += 1; }
  assert.equal(game.clinging, 'right');
  assert.equal(game.facing, -1);
});

test('a leap pressed a moment too early still counts when the climber lands', () => {
  const game = createClimb(7, 240);
  advanceClimb(game, STEP, true);
  let guard = 0;
  while (game.clinging === null && guard < 200) {
    advanceClimb(game, STEP, guard > 20 && guard % 2 === 0 && game.x > game.gap * 0.75);
    guard += 1;
  }
  advanceClimb(game, STEP, false);
  assert.ok(game.clinging === null || game.clinging === 'right');
});

test('hazards are the same every time for a seed, and the first rows are clear', () => {
  for (let row = 0; row < 4; row += 1) assert.equal(hazardInRow(3, row), null);
  assert.deepEqual(hazardInRow(3, 12), hazardInRow(3, 12));
  const seen = Array.from({ length: 40 }, (_, i) => hazardInRow(3, i + 4)).filter(Boolean);
  assert.ok(seen.length > 5);
  const game = createClimb(3, 240);
  game.camY = -2000;
  assert.ok(hazardsAround(game).every((h) => h.y < 600 && h.y > -3200));
});

test('running into a hazard ends the climb', () => {
  const game = createClimb(3, 240);
  const row = Array.from({ length: 60 }, (_, i) => i + 4).find((r) => hazardInRow(3, r)?.side === 'left')!;
  const hazard = hazardInRow(3, row)!;
  game.x = 9; game.clinging = 'left';
  game.y = hazard.y + hazard.h; game.camY = game.y; game.bestY = game.y;
  assert.ok(advanceClimb(game, 0.001, false).fell);
  // The same spot on a wall with no hazard is safe.
  const clear = createClimb(3, 240);
  clear.y = -2; clear.camY = -2;
  assert.ok(!advanceClimb(clear, 0.001, false).fell);
});

test('sliding gets quicker as you climb', () => {
  const game = createClimb(1, 240);
  const low = slideSpeed(game);
  game.bestY = -5000;
  assert.ok(slideSpeed(game) > low);
});
