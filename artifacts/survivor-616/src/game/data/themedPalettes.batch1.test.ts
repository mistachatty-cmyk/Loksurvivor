import test from 'node:test';
import assert from 'node:assert/strict';
import { THEMED_PALETTES } from './themedPalettes';

const KINDS = ['glow', 'pulse', 'prism', 'flicker', 'wave', 'ember', 'orbit', 'echo', 'cycle', 'rain', 'static', 'bloom', 'constellation'];
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

test('the shelf keeps a deep free tier and every tier is stocked', () => {
  const count = (t: string) => THEMED_PALETTES.filter((p) => (p.tier ?? 'standard') === t).length;
  assert.ok(count('standard') >= 26, 'free shelf');
  assert.ok(count('uncommon') >= 21);
  assert.ok(count('rare') >= 47);
  assert.ok(count('legendary') >= 45);
  assert.ok(THEMED_PALETTES.length >= 100, 'toward the 100-customization goal');
});

test('no palette text uses the banned word', () => {
  for (const p of THEMED_PALETTES) assert.ok(!/signal/i.test(`${p.id} ${p.name} ${p.description} ${p.effect?.label ?? ''}`), p.id);
});
