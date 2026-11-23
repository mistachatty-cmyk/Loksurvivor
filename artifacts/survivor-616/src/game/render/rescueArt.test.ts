import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rescuePointerPlacement } from './rescueArt';

test('no pointer while the cage is on screen', () => {
  assert.equal(rescuePointerPlacement(400, 300, 800, 600, 34), null);
});

test('pointer clamps to the right edge and faces right', () => {
  const p = rescuePointerPlacement(2000, 300, 800, 600, 34)!;
  assert.ok(p.x <= 800 - 34 + 0.001 && p.x > 700);
  assert.ok(Math.abs(p.y - 300) < 1 && Math.abs(p.angle) < 0.01);
});

test('pointer in a corner stays inside the margin box', () => {
  const p = rescuePointerPlacement(-900, -900, 800, 600, 34)!;
  assert.ok(p.x >= 34 - 0.001 && p.y >= 34 - 0.001);
});

import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { createWorld, stepWorld, type StepInput } from '@/game/engine/world';
import { drawRescue, drawRescuePointer, RESCUE_BURST_MS } from './rescueArt';

const NEUTRAL = { moveX: 0, moveY: 0 } as unknown as StepInput;

// Node has no Path2D; the glyph drawer only needs to construct one.
(globalThis as unknown as { Path2D: unknown }).Path2D ??= class {};

/** A canvas stand-in that accepts every call; the test only proves nothing throws and something is drawn. */
function fakeCtx() {
  const calls: string[] = [];
  const handler: ProxyHandler<object> = {
    get(_t, prop: string) {
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (prop === 'measureText') return () => ({ width: 10 });
      return (...a: unknown[]) => { calls.push(prop); void a; };
    },
    set() { return true; },
  };
  return { ctx: new Proxy({}, handler) as unknown as CanvasRenderingContext2D, calls };
}

function rescueWorld() {
  const area = AREAS.find((a) => a.rescueAllyId)!;
  const w = createWorld(area, CHARACTERS[0]!, CHARACTERS[0]!.stats, 7);
  w.rescue.status = 'available';
  w.rescue.x = 200; w.rescue.y = 100;
  return w;
}

test('cage draws in every status without throwing, and the burst only plays briefly', () => {
  const w = rescueWorld();
  for (const status of ['pending', 'available', 'freeing', 'freed'] as const) {
    w.rescue.status = status; w.rescue.progress = status === 'freeing' ? 0.6 : 0;
    w.rescue.freedAt = status === 'freed' ? w.now : undefined;
    const { ctx, calls } = fakeCtx();
    drawRescue(ctx, w);
    drawRescuePointer(ctx, w, 800, 600, 1);
    if (status === 'pending') assert.equal(calls.length, 0);
    else assert.ok(calls.length > 0, status);
  }
  w.rescue.freedAt = w.now - RESCUE_BURST_MS - 10;
  const { ctx, calls } = fakeCtx();
  drawRescue(ctx, w);
  assert.equal(calls.length, 0);
});

test('standing in the ring frees the survivor, shakes the screen and queues the freeing sounds', () => {
  const w = rescueWorld();
  w.player.x = w.rescue.x; w.player.y = w.rescue.y;
  w.sfxEvents.length = 0;
  for (let i = 0; i < 120 && w.rescue.status !== 'freed'; i += 1) stepWorld(w, 1 / 30, NEUTRAL);
  assert.equal(w.rescue.status, 'freed');
  assert.ok(w.rescue.freedAt !== undefined);
  const cues = w.sfxEvents.map((e) => e.cue);
  assert.ok(cues.includes('uiNav') || cues.includes('obstacleBreak'));
  assert.ok(cues.includes('lootBox'));
});

import { RESCUE_SIPHON_MS, rescueSiphon } from '@/game/engine/world';

test('ARCHON siphons the held survivor over time, and freeing early pays more', () => {
  const w = rescueWorld();
  w.rescue.appearedAt = w.now;
  assert.equal(rescueSiphon(w), 0);
  w.now += RESCUE_SIPHON_MS / 2;
  assert.ok(Math.abs(rescueSiphon(w) - 0.5) < 0.001);
  w.now += RESCUE_SIPHON_MS * 3;
  assert.equal(rescueSiphon(w), 1);
  w.rescue.status = 'freed';
  assert.equal(rescueSiphon(w), 0);

  const early = rescueWorld(); early.rescue.appearedAt = early.now;
  early.player.x = early.rescue.x; early.player.y = early.rescue.y;
  const credBefore = early.cred;
  for (let i = 0; i < 120 && early.rescue.status !== 'freed'; i += 1) stepWorld(early, 1 / 30, NEUTRAL);
  const earlyGain = early.cred - credBefore;

  const late = rescueWorld(); late.rescue.appearedAt = late.now - RESCUE_SIPHON_MS;
  late.player.x = late.rescue.x; late.player.y = late.rescue.y;
  const lateBefore = late.cred;
  for (let i = 0; i < 120 && late.rescue.status !== 'freed'; i += 1) stepWorld(late, 1 / 30, NEUTRAL);
  assert.ok(earlyGain > late.cred - lateBefore, `early ${earlyGain} should beat late ${late.cred - lateBefore}`);
  assert.ok(late.cred - lateBefore >= 25);
});
