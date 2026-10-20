import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyPaletteStyle, HEX_RE, PALETTE_STYLE_IDS, seedFromId } from './paletteStyles';
import type { SpritePalette } from '@/game/types';

const BASE: SpritePalette = {
  ink: '#101010', body: '#223344', bodyDark: '#112233', accent: '#ff8844', accentBright: '#ffcc88', skin: '#e2b387', glow: '#ffaa55',
};

test('every style produces a full, well-formed seven-key palette', () => {
  for (const style of PALETTE_STYLE_IDS) {
    const result = applyPaletteStyle(BASE, style, 7);
    const keys = Object.keys(result).sort();
    assert.deepEqual(keys, ['accent', 'accentBright', 'body', 'bodyDark', 'glow', 'ink', 'skin']);
    for (const value of Object.values(result)) assert.match(value, HEX_RE);
  }
});

test('original is a pure passthrough', () => {
  assert.deepEqual(applyPaletteStyle(BASE, 'original', 3), BASE);
});

test('seed-dependent styles vary with the seed', () => {
  for (const style of PALETTE_STYLE_IDS) {
    if (style === 'original') continue;
    const a = applyPaletteStyle(BASE, style, 0);
    const b = applyPaletteStyle(BASE, style, 1);
    assert.notDeepEqual(a, b, `${style} should vary by seed`);
  }
});

test('seedFromId is stable for the same id', () => {
  assert.equal(seedFromId('back-alley'), seedFromId('back-alley'));
  assert.notEqual(seedFromId('back-alley'), seedFromId('monroe-strip'));
});
