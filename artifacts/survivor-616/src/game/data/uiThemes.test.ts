import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_UI_THEME_ID,
  UI_THEMES,
  uiLooksForOwnedThemeIds,
} from '@/game/data/uiThemes';

test('the palette catalog has one free default and unique theme ids', () => {
  assert.equal(UI_THEMES[0]?.id, DEFAULT_UI_THEME_ID);
  assert.equal(UI_THEMES[0]?.cost, 0);
  assert.equal(new Set(UI_THEMES.map((theme) => theme.id)).size, UI_THEMES.length);
});

test('every curated palette has a usable primary color and unique ids', () => {
  for (const theme of UI_THEMES) {
    const swatches = theme.swatches ?? [];
    assert.equal(new Set(swatches.map((swatch) => swatch.id)).size, swatches.length);
    assert.ok(swatches.length >= 3, `${theme.id} should offer at least three palettes`);
    for (const swatch of swatches) {
      assert.match(swatch.primaryHsl, /^\d{1,3} \d{1,3}% \d{1,3}%$/);
    }
  }
});

test('the catalog includes a paid theme with a cool night palette', () => {
  const nightDrive = UI_THEMES.find((theme) => theme.id === 'night-drive');
  assert.ok(nightDrive);
  assert.ok(nightDrive.cost > 0);
  assert.ok(nightDrive.swatches?.some((swatch) => swatch.id === 'blue-hour'));
});

test('the catalog makes room for strange, setting-driven themes', () => {
  const themeIds = new Set(UI_THEMES.map((theme) => theme.id));
  assert.ok(themeIds.has('pothole-oracle'));
  assert.ok(themeIds.has('mall-ghost'));
  assert.ok(themeIds.has('weather-radio'));
  assert.ok(UI_THEMES.every((theme) => theme.description.length >= 50));
});

test('owned looks form a stable theme-and-palette rotation', () => {
  const looks = uiLooksForOwnedThemeIds(['house', 'night-drive']);
  assert.deepEqual(looks, [
    { themeId: 'house', swatchId: 'amber-standard' },
    { themeId: 'house', swatchId: 'lake-blue' },
    { themeId: 'house', swatchId: 'copper-rose' },
    { themeId: 'night-drive', swatchId: 'sodium-vapor' },
    { themeId: 'night-drive', swatchId: 'blue-hour' },
    { themeId: 'night-drive', swatchId: 'motel-pink' },
  ]);
  assert.deepEqual(uiLooksForOwnedThemeIds(['unknown-theme']), []);
});