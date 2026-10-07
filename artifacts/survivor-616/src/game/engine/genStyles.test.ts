import assert from 'node:assert/strict';
import test from 'node:test';

import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { getEnemy } from '@/game/data/enemies';
import { AREAS_GEN } from '@/game/data/areas-gen';
import { createWorld, stepWorld } from './world';

const STYLES = [
  ['gen-fit-check-duelist', 'strafe-duelist'],
  ['gen-pin-pouncer', 'pouncer'],
  ['gen-color-wheel', 'beam-wheel'],
  ['gen-grid-stitcher', 'mine-stitcher'],
  ['gen-fan-sampler', 'fan-sampler'],
  ['gen-checkpoint-rewinder', 'rewinder'],
] as const;

test('each Gen Fitters fighting style owns a distinct behavior and spawns on the Fitting Floor', () => {
  assert.equal(new Set(STYLES.map(([, behavior]) => behavior)).size, STYLES.length);
  const spawned = new Set(AREAS_GEN[0]!.waves.map((wave) => wave.enemyId));
  for (const [id, behavior] of STYLES) {
    assert.equal(getEnemy(id).behavior, behavior);
    assert.ok(spawned.has(id), `${id} spawns on the Fitting Floor`);
  }
});

test('each fighting style runs for ten seconds through the real spawn path and acts on the fight', () => {
  for (const [id] of STYLES) {
    const area = {
      ...AREAS[0]!, id: 'style-test', obstacles: [], musicEvents: undefined, rescueAllyId: undefined, durationSec: 60,
      waves: [{ fromSec: 0, toSec: 60, enemyId: id, ratePerSec: 2, burst: 1 }],
    };
    const world = createWorld(area, CHARACTERS[0]!, CHARACTERS[0]!.stats, 77);
    let acted = 0;
    for (let frame = 0; frame < 300; frame += 1) {
      stepWorld(world, 1 / 30, { moveX: 0, moveY: 0, ultimate: false });
      acted += world.effects.filter((e) => e.color && e.uid).length + world.projectiles.filter((pr) => !pr.fromPlayer).length;
      for (const enemy of world.enemies) {
        assert.ok(Number.isFinite(enemy.x) && Number.isFinite(enemy.y), `${id} position stays finite`);
      }
    }
    assert.ok(world.enemies.some((enemy) => enemy.defId === id), `${id} spawned`);
    assert.ok(acted > 0, `${id} produced at least one attack effect or projectile`);
  }
});
