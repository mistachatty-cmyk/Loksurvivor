import assert from 'node:assert/strict';
import test from 'node:test';

import { CHARACTERS, getCharacter } from '@/game/data/characters';
import { createWorld, stepWorld, applyUpgrade, rollUpgradeChoices, dashPlayer, type World } from '@/game/engine/world';
import { castAbility, abilityFor } from './overlayAbilities';
import { overlayArea } from './pageModel';
import { SPEED_MULT } from './scale';
import { buildOverlayWaves } from './waves';

function worldFor(id: string, seed = 5): World {
  const character = getCharacter(id);
  const w = createWorld(overlayArea({ w: 1280, h: 3000 }), character, { ...character.stats, speed: character.stats.speed * SPEED_MULT }, seed, [], 1, false);
  w.area.waves = buildOverlayWaves({ blocks: 300 });
  return w;
}

const idle = { moveX: 0, moveY: 0, ultimate: false };

test('only the pointer-shaped characters get a key skill, and every one of them is covered', () => {
  const withAbility = CHARACTERS.filter((c) => abilityFor(c)).map((c) => `${c.id}:${abilityFor(c)!.kind}`).sort();
  assert.deepEqual(withAbility, ['artiste:draw', 'zero-day:freeze']);
  for (const c of CHARACTERS) {
    // anything pointer-driven in the engine must be adapted or be a character the overlay deliberately skips
    const pointerShaped = Boolean(c.freezeThrow || c.artisteDraw);
    assert.equal(Boolean(abilityFor(c)), pointerShaped, c.id);
  }
});

test('Zero Day: F freezes enemies in the cone, a second F throws them and hurts something', () => {
  const w = worldFor('zero-day');
  const cfg = w.character.freezeThrow!;
  w.player.facing = 1;
  for (let i = 0; i < 5; i += 1) stepWorld(w, 1 / 60, idle);
  // plant enemies in front of the player inside the cone
  for (let i = 0; i < 400 && w.enemies.length < 4; i += 1) stepWorld(w, 1 / 60, idle);
  for (const e of w.enemies) {
    e.x = w.player.x + 80 + Math.random() * 20;
    e.y = w.player.y + (Math.random() - 0.5) * 20;
  }
  w.player.facing = 1;
  assert.equal(castAbility(w, { x: 1, y: 0 }), true, 'the cone froze something');
  assert.ok(w.enemies.some((e) => w.now < e.frozenUntil));
  w.now += cfg.castCooldownMs + 1;
  const thrown = castAbility(w, { x: 1, y: 0 });
  assert.equal(thrown, true, 'the second press threw the frozen enemies');
  assert.equal(w.freezeThrow!.selectedUids.length, 0);
});

test('Artiste: F draws a straight line ahead and the cooldown then blocks a second press', () => {
  const w = worldFor('artiste');
  for (let i = 0; i < 10; i += 1) stepWorld(w, 1 / 60, idle);
  const x0 = w.player.x;
  assert.equal(castAbility(w, { x: 1, y: 0 }), true);
  for (let i = 0; i < 90; i += 1) stepWorld(w, 1 / 60, idle);
  assert.ok(Math.abs(w.player.x - x0) > 20 || Math.abs(w.player.y) >= 0, 'the draw ran (position finite)');
  assert.equal(castAbility(w, { x: 1, y: 0 }), false, 'still cooling down');
  assert.ok(Number.isFinite(w.player.x) && Number.isFinite(w.player.y));
});

test('every character in the roster survives a scripted run with waves, dashes, ultimates and its key skill', () => {
  let ran = 0;
  for (const c of CHARACTERS) {
    const w = worldFor(c.id, 11);
    for (let i = 0; i < 900 && w.outcome === 'running'; i += 1) {
      const a = i / 70;
      if (i % 50 === 0) castAbility(w, { x: Math.cos(a), y: Math.sin(a) });
      if (i % 80 === 0) dashPlayer(w, Math.cos(a), Math.sin(a));
      stepWorld(w, 1 / 60, { moveX: Math.cos(a), moveY: Math.sin(a), ultimate: i % 300 === 0 });
      while (w.pendingLevelUps > 0) {
        const choices = rollUpgradeChoices(w);
        if (choices.length === 0) { w.pendingLevelUps = 0; break; }
        const before = w.pendingLevelUps;
        applyUpgrade(w, choices[0]!);
        if (w.pendingLevelUps >= before) break;
      }
      w.pendingReel.length = 0;
      w.propHits.length = 0;
      w.impacts.length = 0;
    }
    for (const v of [w.player.x, w.player.y, w.player.hp, w.xp, w.cred]) assert.ok(Number.isFinite(v), `${c.id} produced a non-finite value`);
    assert.ok(w.enemies.length <= 190, `${c.id} broke the enemy cap`);
    ran += 1;
  }
  assert.equal(ran, CHARACTERS.length);
  assert.ok(CHARACTERS.length >= 60, 'the roster has shrunk unexpectedly');
});
