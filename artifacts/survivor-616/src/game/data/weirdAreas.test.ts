import assert from 'node:assert/strict';
import test from 'node:test';

import { AREAS } from '@/game/data/areas';
import { WEIRD_AREAS } from '@/game/data/areas-weird';
import { CHARACTERS } from '@/game/data/characters';
import { createWorld, stepWorld } from '@/game/engine/world';

const EXPECTED_IDS = ['mirror-mile', 'clockmouth-roundabout', 'null-orchard', 'sideways-forty'];

test('Odd Routes register four distinct large arenas', () => {
  assert.deepEqual(WEIRD_AREAS.map((area) => area.id), EXPECTED_IDS);
  assert.equal(new Set(AREAS.map((area) => area.id)).size, AREAS.length, 'all area ids must remain unique');

  for (const area of WEIRD_AREAS) {
    assert.ok(area.bounds.w >= 1300 && area.bounds.h >= 1000, `${area.id} must read as a large map`);
    assert.ok(area.obstacles.length >= 12, `${area.id} needs a deliberate spatial grammar`);
    assert.ok(area.waves.length >= 5, `${area.id} needs a complete survival curve`);
    assert.ok(area.landmark, `${area.id} needs a visible weird landmark`);
    assert.ok(AREAS.some((candidate) => candidate.id === area.id), `${area.id} must be selectable`);

    for (const obstacle of area.obstacles) {
      assert.ok(Math.abs(obstacle.x) + obstacle.w / 2 < area.bounds.w / 2, `${area.id} obstacle exceeds horizontal bounds`);
      assert.ok(Math.abs(obstacle.y) + obstacle.h / 2 < area.bounds.h / 2, `${area.id} obstacle exceeds vertical bounds`);
    }
  }
});

test('each Odd Route has its own cheap mechanical hook', () => {
  const byId = Object.fromEntries(WEIRD_AREAS.map((area) => [area.id, area]));
  assert.ok(byId['mirror-mile']!.obstacles.filter((obstacle) => obstacle.kind === 'reflective-surface').length >= 10);
  assert.ok(byId['clockmouth-roundabout']!.obstacles.some((obstacle) => obstacle.kind === 'pothole'));
  assert.ok(byId['null-orchard']!.obstacles.some((obstacle) => obstacle.kind === 'fuse-box') && byId['null-orchard']!.randomDrops);
  assert.ok(byId['sideways-forty']!.obstacles.some((obstacle) => obstacle.kind === 'attack-block'));
});

test('every Odd Route launches and advances through real combat simulation', () => {
  const character = CHARACTERS[0]!;
  for (const area of WEIRD_AREAS) {
    const world = createWorld(area, character, character.stats, 616, [], 1, true, null, {});
    world.player.invulnUntil = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 300; i += 1) stepWorld(world, 1 / 30, { moveX: 0, moveY: 0, ultimate: false });
    assert.equal(world.outcome, 'running', `${area.id} must remain playable after launch`);
    assert.ok(world.time >= 9.9, `${area.id} must advance its timer`);
    assert.ok(world.enemies.length + world.kills > 0, `${area.id} must execute its wave table`);
  }
});
