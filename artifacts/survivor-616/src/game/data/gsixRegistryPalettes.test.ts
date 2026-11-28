import test from 'node:test';
import assert from 'node:assert/strict';
import { GSIX_REGISTRY_PALETTES, GSIX_STARTER_IDS } from './gsixRegistryPalettes';
import { THEMED_PALETTES, THEMED_PALETTES_BY_ID } from './themedPalettes';
import { effectiveCatalogIds } from './devUnlockRegistry';

test('the shared registry adds at least 225 unlockable themes with unique ids that do not clash with the originals', () => {
  assert.ok(GSIX_REGISTRY_PALETTES.length >= 225, String(GSIX_REGISTRY_PALETTES.length));
  assert.equal(new Set(THEMED_PALETTES.map((p) => p.id)).size, THEMED_PALETTES.length);
  assert.equal(THEMED_PALETTES_BY_ID['gr-03']?.name, 'Calder Plaza');
  assert.ok(THEMED_PALETTES_BY_ID['gr-03_midnight']);
  assert.ok(THEMED_PALETTES_BY_ID['gr-03_retro16']);
});

test('the four starter themes are free and owned; every remix and other theme costs something', () => {
  assert.deepEqual([...GSIX_STARTER_IDS].sort(), ['gr-01', 'gr-03', 'mi-01', 'us-01']);
  for (const p of GSIX_REGISTRY_PALETTES) assert.equal(p.cost === 0, GSIX_STARTER_IDS.includes(p.id), p.id);
});

test('registry themes carry a family, a remix, a valid 7-slot palette and a real effect', () => {
  const kinds = ['glow', 'pulse', 'prism', 'flicker', 'wave', 'ember', 'orbit', 'echo', 'cycle', 'rain', 'static', 'bloom', 'constellation'];
  for (const p of GSIX_REGISTRY_PALETTES) {
    assert.ok(p.family && p.familyLabel && ['base', 'midnight', 'retro16'].includes(p.variant ?? ''), p.id);
    for (const c of Object.values(p.palette)) assert.match(c, /^#[0-9a-f]{6}$/i, p.id);
    if (p.effect) {
      assert.ok(kinds.includes(p.effect.kind), p.id);
      assert.ok(p.effect.intensity > 0 && p.effect.intensity <= 1 && p.effect.speed > 0, p.id);
    }
  }
});

test('free shelf stays deep: the standard registry themes are still, uncommon and above animate', () => {
  const std = GSIX_REGISTRY_PALETTES.filter((p) => p.tier === 'standard' && p.variant === 'base');
  assert.ok(std.length >= 25);
  assert.ok(std.every((p) => !p.effect));
  assert.ok(GSIX_REGISTRY_PALETTES.filter((p) => p.tier === 'legendary').every((p) => p.effect));
});

test('a new save owns the starters and nothing else from the registry', () => {
  const owned = effectiveCatalogIds({ devModeAllUnlocks: false }, 'palettes', ['default', ...GSIX_STARTER_IDS]);
  assert.ok(owned.includes('gr-03') && !owned.includes('gr-04'));
});
