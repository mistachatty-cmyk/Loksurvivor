import assert from 'node:assert/strict';
import test from 'node:test';

import { hudSnapshot, createWorld } from '@/game/engine/world';
import { getArea } from './areas';
import { getCharacter } from './characters';
import { runHudIntelCount, selectPrimaryRunHudSignal } from './runHudLayout';

test('arena HUD selects one signal even when many secondary systems are active', () => {
  const character = getCharacter('shade');
  const world = createWorld(getArea('back-alley'), character, character.stats);
  const hud = hudSnapshot(world);
  hud.alerts.push('First', 'Newest');
  hud.objectives.push({ label: 'Hold the corner', progress: 2, target: 8, completed: false });
  const signal = selectPrimaryRunHudSignal(hud, ['Hard Night']);
  assert.ok(signal?.label);
  assert.equal(typeof signal?.detail, 'string');
  assert.ok(runHudIntelCount(hud, 1) >= 2);
});

test('rescue cues outrank objectives and alerts without stacking them', () => {
  const character = getCharacter('shade');
  const hud = hudSnapshot(createWorld(getArea('back-alley'), character, character.stats));
  hud.rescueAvailable = true;
  hud.rescueAllyName = 'Vee';
  hud.objectives.push({ label: 'Other work', progress: 0, target: 1, completed: false });
  assert.deepEqual(selectPrimaryRunHudSignal(hud, [])?.label, 'Vee is caged');
});
