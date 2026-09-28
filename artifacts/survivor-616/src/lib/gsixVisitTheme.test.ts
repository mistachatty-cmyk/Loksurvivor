import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToHslTriplet, parseVisitTheme, visitThemeStyle } from './gsixVisitTheme';

const nightShift = '?lok_theme=night-shift&lok_palette=0a0b12-f4efe6-9d9cab-ff8a3d-8a2433-ffd166-d6d2cc';

test('parses a GSix theme handoff', () => {
  const theme = parseVisitTheme(nightShift);
  assert.equal(theme?.id, 'night-shift');
  assert.equal(theme?.colors.accent, '#ff8a3d');
  assert.equal(theme?.colors.bg, '#0a0b12');
});

test('rejects malformed or missing palettes', () => {
  assert.equal(parseVisitTheme(''), null);
  assert.equal(parseVisitTheme('?lok_theme=night-shift'), null);
  assert.equal(parseVisitTheme('?lok_theme=x&lok_palette=zzzzzz-000000-000000-000000-000000-000000-000000'), null);
  assert.equal(parseVisitTheme('?lok_theme=<script>&lok_palette=000000-000000-000000-000000-000000-000000-000000'), null);
});

test('converts hex to the H S% L% token format', () => {
  assert.equal(hexToHslTriplet('#ff0000'), '0 100% 50%');
  assert.equal(hexToHslTriplet('#000000'), '0 0% 0%');
  assert.equal(hexToHslTriplet('#000000', 5), '0 0% 5%');
});

test('maps every theme token the menus read', () => {
  const style = visitThemeStyle(parseVisitTheme(nightShift)!);
  for (const token of ['--background', '--foreground', '--primary', '--primary-foreground', '--card', '--border', '--ring']) {
    assert.match(style[token]!, /^\d+ \d+% \d+%$/, token);
  }
});
