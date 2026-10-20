import assert from 'node:assert/strict';
import test from 'node:test';

import { getCharacter } from '@/game/data/characters';
import { createWorld, type Projectile } from '@/game/engine/world';
import { overlayArea } from './pageModel';
import { LIGHT_CAP, collectLights } from './lights';

const view = { left: -300, top: -200, right: 300, bottom: 200 };

function world() {
  const foreman = getCharacter('foreman');
  return createWorld(overlayArea({ w: 1200, h: 1200 }), foreman, foreman.stats, 9);
}

function shot(x: number, y: number): Projectile {
  return { uid: x * 1000 + y, x, y, vx: 0, vy: 0, radius: 6, damage: 1, impactIntensity: 1, fromPlayer: true, expiresAt: 1e9, targetUid: null, turnRate: 0, color: '#ff8800', trail: [], pierce: 0, hitUids: new Set() } as Projectile;
}

test('the player always carries a faint light, and the ultimate makes it a big one', () => {
  const w = world();
  const calm = collectLights(w, view);
  assert.equal(calm.length, 1);
  w.ultActiveUntil = w.now + 1000;
  const ult = collectLights(w, view);
  assert.ok(ult[0]!.r > calm[0]!.r * 3 && ult[0]!.a > calm[0]!.a);
});

test('only glows near the view are collected, and projectiles brighten their colour', () => {
  const w = world();
  w.projectiles.push(shot(50, 50), shot(5000, 5000));
  const lights = collectLights(w, view);
  assert.equal(lights.length, 2, 'the player plus the one nearby shot');
  assert.ok(lights.some((l) => l.color === '#ff8800' && l.r > 6));
});

test('a recent impact flashes hot and the list never exceeds the cap, keeping the strongest', () => {
  const w = world();
  w.impacts.push({ x: 10, y: 10, radius: 60, amount: 20, intensity: 2, at: 0 });
  for (let i = 0; i < 200; i += 1) w.projectiles.push(shot(i - 100, 0));
  const lights = collectLights(w, view);
  assert.equal(lights.length, LIGHT_CAP);
  assert.ok(lights.some((l) => l.a === 0.8), 'the impact flash survives the cut');
});
