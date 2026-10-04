import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { flatten, samePlaceholders } from '@lok/auto-l10n';

/**
 * Guards the locale files, not the translator. `en.json` is hand-written and
 * every other language file is generated, so these checks catch the mistakes
 * that actually happen: a malformed placeholder, a half-written plural pair, a
 * generated string that dropped a variable, or a banned word.
 */

const BANNED = new RegExp(['sig', 'nal'].join(''), 'i');
const LOCALES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'locales');

function readLocale(file: string): Record<string, string> {
  return flatten(JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, file), 'utf8')));
}

const english = readLocale('en.json');
const otherLocales = fs
  .readdirSync(LOCALES_DIR)
  .filter((name) => /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]+)*\.json$/.test(name) && name !== 'en.json');

test('en.json has no empty strings and no banned words', () => {
  assert.ok(Object.keys(english).length > 0);
  for (const [key, value] of Object.entries(english)) {
    assert.ok(value.trim().length > 0, `${key} is empty`);
    assert.ok(!BANNED.test(key) && !BANNED.test(value), `${key} uses a banned word`);
  }
});

test('en.json placeholders are well formed', () => {
  for (const [key, value] of Object.entries(english)) {
    const opens = (value.match(/\{\{/g) ?? []).length;
    const closes = (value.match(/\}\}/g) ?? []).length;
    assert.equal(opens, closes, `${key} has unbalanced {{ }}`);
    const wellFormed = [...value.matchAll(/\{\{\s*[A-Za-z_][\w.]*\s*\}\}/g)].length;
    assert.equal(wellFormed, opens, `${key} has a {{placeholder}} that is not a plain name`);
  }
});

test('plural keys come as complete pairs', () => {
  for (const key of Object.keys(english)) {
    if (key.endsWith('_one')) assert.ok(`${key.slice(0, -4)}_other` in english, `${key} has no _other form`);
  }
});

test('every hub room has both a label and a description', () => {
  const rooms = new Set<string>();
  for (const key of Object.keys(english)) {
    const match = /^hub\.room\.(.+)\.(label|description)$/.exec(key);
    if (match) rooms.add(match[1]!);
  }
  assert.ok(rooms.size >= 20);
  for (const room of rooms) {
    assert.ok(`hub.room.${room}.label` in english, `${room} is missing a label`);
    assert.ok(`hub.room.${room}.description` in english, `${room} is missing a description`);
  }
});

test('generated locale files only use keys and placeholders that exist in English', () => {
  for (const file of otherLocales) {
    const translated = readLocale(file);
    for (const [key, value] of Object.entries(translated)) {
      assert.ok(key in english, `${file}: "${key}" is not in en.json (run auto-l10n sync --prune)`);
      assert.ok(samePlaceholders(english[key]!, value), `${file}: "${key}" has different {{placeholders}} than English`);
      assert.ok(!BANNED.test(value), `${file}: "${key}" contains a banned word`);
    }
  }
});
