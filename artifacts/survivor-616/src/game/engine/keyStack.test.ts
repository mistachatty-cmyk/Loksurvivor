import assert from 'node:assert/strict';
import test from 'node:test';

import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { keyStackPose } from '@/game/render/draw';
import { KEY_STACK_JOIN_MS, KEY_STACK_LIFE_MS, collectSkeletonKey, createWorld, stepWorld, type World } from '@/game/engine/world';

const neutralInput = { moveX: 0, moveY: 0, aimX: 1, aimY: 0, dash: false, special: false, ultimate: false } as unknown as Parameters<typeof stepWorld>[2];

function quietWorld(): World {
  const area = { ...Object.values(AREAS)[0]!, obstacles: [], waves: [] };
  const w = createWorld(area, CHARACTERS[0]!, CHARACTERS[0]!.stats, 616);
  w.enemies.length = 0;
  w.pickups.length = 0;
  return w;
}

test('standing on a locked vault chest shows the hint once per beat, over the chest', () => {
  const w = quietWorld();
  w.skeletonKeysGained = 0;
  w.pickups.push({ uid: 9001, kind: 'relic-vault-chest', x: w.player.x, y: w.player.y, vx: 0, vy: 0, value: 1, bornAt: 0 });
  for (let frame = 0; frame < 120; frame += 1) stepWorld(w, 1 / 60, neutralInput);
  const hints = w.popups.filter((p) => p.text.startsWith('LOCKED'));
  assert.ok(hints.length <= 2, `got ${hints.length}`);
  assert.ok(w.pickups.some((p) => p.kind === 'relic-vault-chest'), 'the chest stays');
  assert.ok(hints.every((p) => Math.abs(p.x - w.player.x) < 40 && p.y < w.player.y), 'hint sits above the chest');
});

test('several keys at once merge into one stack with one alert and no per-key popups', () => {
  const w = quietWorld();
  for (let i = 0; i < 4; i += 1) collectSkeletonKey(w, 1);
  assert.equal(w.skeletonKeysGained, 4);
  assert.equal(w.keyStack?.count, 4);
  assert.equal(w.popups.filter((p) => /KEY/.test(p.text)).length, 0);
  assert.equal(w.alerts.filter((a) => a.text === 'Skeleton key found').length, 1);
  assert.equal(w.sfxEvents.filter((e) => e.cue === 'pickupKey').length, 1);
});

test('the stack expires after about a second idle and a later key starts a fresh one', () => {
  const w = quietWorld();
  collectSkeletonKey(w, 1);
  w.now += KEY_STACK_JOIN_MS - 100;
  collectSkeletonKey(w, 1);
  assert.equal(w.keyStack?.count, 2);
  for (let frame = 0; frame < Math.ceil((KEY_STACK_LIFE_MS + 200) / 16); frame += 1) stepWorld(w, 0.016, neutralInput);
  assert.equal(w.keyStack, null);
  collectSkeletonKey(w, 1);
  assert.equal(w.keyStack?.count, 1);
  assert.equal(w.skeletonKeysGained, 3);
});

test('reduced motion keeps the stack still: no spring, rise, fan or trailing', () => {
  const w = quietWorld();
  collectSkeletonKey(w, 2);
  w.player.vx = 200;
  w.player.vy = 100;
  w.now += 50;
  const still = keyStackPose(w, false);
  assert.deepEqual([still.popScale, still.rise, still.fan, still.trailX, still.trailY], [1, 0, 0, 0, 0]);
  const lively = keyStackPose(w, true);
  assert.ok(lively.popScale > 1 && lively.fan > 0 && lively.trailX < 0);
  w.now += KEY_STACK_LIFE_MS - 100;
  assert.ok(keyStackPose(w, false).alpha < 1, 'still fades out');
  assert.equal(keyStackPose(w, false).rise, 0);
});
