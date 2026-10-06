import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_SETTINGS,
  SETTINGS_SCHEMA,
  decodeSettingsCode,
  encodeSettingsCode,
  gameSpeedFactor,
  loadSettings,
  nextSetting,
  optionValues,
  sanitizeSettings,
  saveSettings,
  type KeyValueStorage,
} from './settings';

function memory(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

test('the schema covers every setting exactly once and every default is an allowed value', () => {
  const ids = SETTINGS_SCHEMA.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), Object.keys(DEFAULT_SETTINGS).sort());
  for (const def of SETTINGS_SCHEMA) {
    const value = String((DEFAULT_SETTINGS as unknown as Record<string, unknown>)[def.id]);
    assert.ok(optionValues(def).includes(value), `${def.id} default ${value}`);
  }
});

test('sanitize drops unknown keys, wrong types and out-of-range choices, and never throws', () => {
  const s = sanitizeSettings({ mode: 'zen', levelUp: 'banana', gameSpeed: '9', shake: 'yes', hitStop: false, evil: 1 });
  assert.equal(s.mode, 'zen');
  assert.equal(s.levelUp, DEFAULT_SETTINGS.levelUp);
  assert.equal(s.gameSpeed, DEFAULT_SETTINGS.gameSpeed);
  assert.equal(s.shake, DEFAULT_SETTINGS.shake);
  assert.equal(s.hitStop, false);
  assert.equal('evil' in s, false);
  assert.deepEqual(sanitizeSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(sanitizeSettings('x'), DEFAULT_SETTINGS);
});

test('settings round-trip through storage, and bad stored data or blocked storage fall back to defaults', () => {
  const store = memory();
  const changed = { ...DEFAULT_SETTINGS, mode: 'zen' as const, glow: false };
  saveSettings(store, changed);
  assert.deepEqual(loadSettings(store), changed);
  store.data.set('demoday.settings.v1', '{not json');
  assert.deepEqual(loadSettings(store), DEFAULT_SETTINGS);
  assert.deepEqual(loadSettings(null), DEFAULT_SETTINGS);
  const throwing: KeyValueStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.deepEqual(loadSettings(throwing), DEFAULT_SETTINGS);
  assert.doesNotThrow(() => saveSettings(throwing, changed));
});

test('toggles flip and choices cycle through their options and wrap', () => {
  let s = DEFAULT_SETTINGS;
  s = nextSetting(s, 'shake');
  assert.equal(s.shake, !DEFAULT_SETTINGS.shake);
  s = nextSetting(s, 'gameSpeed');
  assert.equal(s.gameSpeed, '1.15');
  s = nextSetting(s, 'gameSpeed');
  s = nextSetting(s, 'gameSpeed');
  assert.equal(s.gameSpeed, '1', 'wraps back to the first option');
  assert.equal(gameSpeedFactor({ ...DEFAULT_SETTINGS, gameSpeed: '1.3' }), 1.3);
  assert.equal(nextSetting(DEFAULT_SETTINGS, 'nope' as never), DEFAULT_SETTINGS);
});

test('the settings code round-trips, is url-safe, and rejects junk', () => {
  const s = { ...DEFAULT_SETTINGS, mode: 'zen' as const, sfx: false, gameSpeed: '1.3' as const };
  const code = encodeSettingsCode(s);
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeSettingsCode(code), s);
  assert.deepEqual(decodeSettingsCode(`  ${code}  `), s);
  assert.equal(decodeSettingsCode('%%%not-a-code'), null);
  assert.equal(decodeSettingsCode(''), null);
});
