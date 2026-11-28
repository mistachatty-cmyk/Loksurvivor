import test from 'node:test';
import assert from 'node:assert/strict';
import { THEMED_PALETTES } from './themedPalettes';

const KINDS = ['glow', 'pulse', 'prism', 'flicker', 'wave', 'ember', 'orbit', 'echo'];
const NEW = ['lacquer-hour', 'moth-lantern', 'tidepool-static', 'back-porch-coals', 'afterimage'];

test('palette ids are unique', () => {
  const ids = THEMED_PALETTES.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every effect kind is a real kind', () => {
  for (const p of THEMED_PALETTES) if (p.effect) assert.ok(KINDS.includes(p.effect.kind), p.id);
});

test('batch 1 palettes exist with the intended effects', () => {
  const by = Object.fromEntries(THEMED_PALETTES.map((p) => [p.id, p]));
  for (const id of NEW) assert.ok(by[id], id);
  assert.equal(by['afterimage']!.effect?.kind, 'echo');
  assert.equal(by['afterimage']!.tier, 'legendary');
  assert.equal(by['lacquer-hour']!.effect?.kind, 'ember');
});
