import assert from 'node:assert/strict';
import test from 'node:test';

import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { WEAPONS_BY_ID } from '@/game/data/weapons';
import { createWorld, stepWorld } from '@/game/engine/world';
import type { CharacterDef } from '@/game/types';

function testCharacter(weaponId: string): CharacterDef {
  const weapon = WEAPONS_BY_ID[weaponId]!;
  return { ...CHARACTERS[0]!, weapon };
}

// loadDungeonRoom() centers each room's obstacles/exit on the player's
// current position, but the movement clamp (clampToArena/arenaWallBounds)
// confines the player to a box around dungeonCenterX/Y -- which used to be
// set only once, on first entry. Rooms 2 and 3 would then place their exit
// centered on the player's drifted position while the clamp still confined
// them to room 1's box, stranding the run behind an unreachable "EXIT".
test('every endless-mode dungeon room exit is actually reachable', () => {
  const endlessArea = AREAS.find((area) => area.endless);
  assert.ok(endlessArea, 'expected an endless AreaDef to exist');

  const world = createWorld(endlessArea!, testCharacter('chain-whip'), CHARACTERS[0]!.stats, 12345);
  assert.ok(world.endless, 'endless state should exist for an endless area');

  // Force a dungeon entrance exactly at the player's spawn point so the next
  // step triggers enterDungeon() through the real updateEndlessDungeon path,
  // the same as a player walking onto one.
  world.endless!.dungeonEntrances.push({
    x: world.player.x,
    y: world.player.y,
    w: 56,
    h: 16,
    chunkKey: 'test-chunk',
  });
  stepWorld(world, 1 / 60, { moveX: 0, moveY: 0, ultimate: false });
  assert.equal(world.endless!.inDungeon, true, 'expected to have entered the dungeon');
  assert.equal(world.endless!.dungeonRoom, 1, 'expected to start in room 1');

  const walkToExit = (label: string) => {
    const e = world.endless!;
    const maxSteps = 3000;
    let lastDist = Infinity;
    for (let steps = 0; steps < maxSteps; steps += 1) {
      if (!e.inDungeon) return;
      const exit = e.exitZone;
      assert.ok(exit, `${label}: no exitZone while inDungeon`);
      const dx = exit!.x - world.player.x;
      const dy = exit!.y - world.player.y;
      const dist = Math.hypot(dx, dy);
      const startedRoom = e.dungeonRoom;
      const mag = Math.max(dist, 1e-6);
      stepWorld(world, 1 / 60, { moveX: dx / mag, moveY: dy / mag, ultimate: false });
      if (e.dungeonRoom !== startedRoom || !e.inDungeon) return;
      // Confirm real progress toward the exit every so often -- a clamp/exit
      // mismatch strands the player at a fixed distance instead of shrinking it.
      if (steps % 500 === 499) {
        assert.ok(dist < lastDist - 0.5, `${label}: stuck -- distance to exit stopped shrinking (${lastDist.toFixed(1)} -> ${dist.toFixed(1)})`);
        lastDist = dist;
      }
    }
    assert.fail(`${label}: never reached the exit within ${maxSteps} steps -- exit is unreachable`);
  };

  walkToExit('room 1 -> 2');
  assert.equal(world.endless!.dungeonRoom, 2, 'expected to have advanced to room 2');

  walkToExit('room 2 -> 3');
  assert.equal(world.endless!.dungeonRoom, 3, 'expected to have advanced to room 3');

  walkToExit('room 3 -> street');
  assert.equal(world.endless!.inDungeon, false, 'expected to have exited the dungeon entirely after room 3');
});
