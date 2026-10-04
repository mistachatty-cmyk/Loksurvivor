import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  flatten,
  hasTranslatableText,
  isNested,
  maskProtected,
  matchesAny,
  placeholdersOf,
  samePlaceholders,
  unflatten,
  unmask,
} from '../src/core.js';

test('flatten and unflatten round-trip nested messages', () => {
  const nested = { menu: { play: 'Play', quit: 'Quit' }, title: 'Game' };
  const flat = flatten(nested);
  assert.deepEqual(flat, { 'menu.play': 'Play', 'menu.quit': 'Quit', title: 'Game' });
  assert.deepEqual(unflatten(flat), nested);
  assert.equal(isNested(nested), true);
  assert.equal(isNested(flat), false);
});

test('flatten skips underscore metadata keys and non-string values', () => {
  assert.deepEqual(flatten({ _comment: 'ignore me', a: 'x', n: 5, list: ['no'], deep: { _note: 'skip', b: 'y' } }), { a: 'x', 'deep.b': 'y' });
});

test('placeholders are found, de-duplicated and compared', () => {
  assert.deepEqual(placeholdersOf('Hi {{ name }}, {{name}} has {{stats.hp}} HP'), ['name', 'stats.hp']);
  assert.equal(samePlaceholders('A {{x}} B', 'Un {{x}} C'), true);
  assert.equal(samePlaceholders('A {{x}}', 'A {{y}}'), false);
  assert.equal(samePlaceholders('A {{x}}', 'A'), false);
});

test('mask and unmask protect placeholders and glossary terms', () => {
  const { text, tokens } = maskProtected('{{name}} found a LokPet in LokPets Hall', ['Lok', 'LokPet', 'LokPets']);
  assert.ok(!text.includes('{{'));
  assert.ok(!text.includes('LokPet'));
  assert.equal(tokens.length, 3);
  assert.equal(unmask(text, tokens), '{{name}} found a LokPet in LokPets Hall');
});

test('glossary terms only match whole words', () => {
  const { text } = maskProtected('Lokomotive and Lok', ['Lok']);
  assert.ok(text.includes('Lokomotive'));
  assert.ok(!/\bLok\b/.test(text));
});

test('unmask tolerates spacing and case changes, and rejects lost tokens', () => {
  const { tokens } = maskProtected('Hello {{a}} and {{b}}');
  assert.equal(unmask('Hola zq0zq y ZQ 1 ZQ', tokens), 'Hola {{a}} y {{b}}');
  assert.equal(unmask('Hola ZQ0ZQ', tokens), null);
});

test('strings with nothing to translate are detected', () => {
  assert.equal(hasTranslatableText(maskProtected('{{n}}').text), false);
  assert.equal(hasTranslatableText('616'), false);
  assert.equal(hasTranslatableText(maskProtected('Level {{n}}').text), true);
});

test('key patterns match with * wildcards', () => {
  assert.equal(matchesAny('brand.name', ['brand.*']), true);
  assert.equal(matchesAny('menu.brand', ['brand.*']), false);
  assert.equal(matchesAny('a.b', ['a.b']), true);
});
