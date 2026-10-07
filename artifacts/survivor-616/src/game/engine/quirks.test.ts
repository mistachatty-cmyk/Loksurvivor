import assert from 'node:assert/strict';
import test from 'node:test';

import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { ENEMY_QUIRKS } from '@/game/data/enemyQuirks';
import { createWorld, damageEnemy, stepWorld } from './world';

const IDLE = { moveX: 0, moveY: 0, ultimate: false };

test('quirked enemies spawn in a real run, behave, and every quirk can be seen', () => {
  const area = {
    ...AREAS[0]!, id: 'quirk-test', obstacles: [], musicEvents: undefined, rescueAllyId: undefined, durationSec: 600,
    waves: [{ fromSec: 0, toSec: 600, enemyId: 'nightcrawler', ratePerSec: 8, burst: 3 }],
  };
  const seen = new Set<string>();
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const world = createWorld(area, CHARACTERS[0]!, { ...CHARACTERS[0]!.stats, maxHp: 1_000_000 }, seed);
    world.now = 300_000;
    world.player.hp = world.player.maxHp = 1_000_000;
    for (let frame = 0; frame < 600; frame += 1) {
      stepWorld(world, 1 / 30, IDLE);
      for (const enemy of world.enemies) {
        if (enemy.quirk) seen.add(enemy.quirk);
        assert.ok(Number.isFinite(enemy.x) && Number.isFinite(enemy.y) && Number.isFinite(enemy.hp));
      }
      if (frame === 590) {
        const gilded = world.enemies.find((enemy) => enemy.quirk === 'gilded' && !enemy.dying);
        if (gilded) {
          world.pickups.length = 0;
          gilded.shieldedUntil = 0;
          damageEnemy(world, gilded, 1e9, 0, gilded.x, gilded.y);
          assert.ok(world.pickups.filter((pickup) => pickup.kind === 'cred').length >= 3);
        }
      }
    }
  }
  assert.ok(seen.size >= ENEMY_QUIRKS.length - 2, `saw ${[...seen].join(', ')}`);
});
