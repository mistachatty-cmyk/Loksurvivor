import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createL10n, detectLocale, directionOf, interpolate, normalizeLocale, resolveLocale } from '../src/index.js';

const en = { 'menu.play': 'Play', 'hud.score': 'Score: {{score}}', 'only.en': 'English only', 'loot.count_one': '{{count}} item', 'loot.count_other': '{{count}} items' };
const es = { 'menu.play': 'Jugar', 'hud.score': 'Puntos: {{score}}', 'loot.count_one': '{{count}} objeto', 'loot.count_other': '{{count}} objetos' };

test('normalizeLocale canonicalizes casing and separators', () => {
  assert.equal(normalizeLocale('pt_br'), 'pt-BR');
  assert.equal(normalizeLocale('ZH-hant-tw'), 'zh-Hant-TW');
  assert.equal(normalizeLocale(undefined), '');
});

test('resolveLocale falls back through subtags and regional siblings', () => {
  const supported = ['en', 'pt-BR', 'zh-CN', 'es'];
  assert.equal(resolveLocale('es-MX', supported), 'es');
  assert.equal(resolveLocale('pt', supported), 'pt-BR');
  assert.equal(resolveLocale('pt-PT', supported), 'pt-BR');
  assert.equal(resolveLocale('EN-us', supported), 'en');
  assert.equal(resolveLocale('xx', supported, 'en'), 'en');
});

test('detectLocale prefers a stored choice, then browser languages, ignoring "auto"', () => {
  const supported = ['en', 'es', 'fr'];
  assert.equal(detectLocale({ supported, stored: 'fr', languages: ['es'] }), 'fr');
  assert.equal(detectLocale({ supported, stored: 'auto', languages: ['de', 'es-MX'] }), 'es');
  assert.equal(detectLocale({ supported, stored: 'zz', languages: ['xx'] }), 'en');
});

test('interpolate fills placeholders and leaves unknown ones visible', () => {
  assert.equal(interpolate('Hi {{ name }}!', { name: 'Ana' }), 'Hi Ana!');
  assert.equal(interpolate('HP {{stats.hp}}', { stats: { hp: 0 } }), 'HP 0');
  assert.equal(interpolate('Hi {{who}}', { name: 'x' }), 'Hi {{who}}');
});

test('t() looks up the active locale, then the default, then the key', () => {
  const l10n = createL10n({ messages: { en, es } });
  assert.equal(l10n.t('menu.play'), 'Play');
  l10n.register('fr', { 'menu.play': 'Jouer' });
  return l10n.setLocale('fr').then(() => {
    assert.equal(l10n.t('menu.play'), 'Jouer');
    assert.equal(l10n.t('only.en'), 'English only');
    assert.equal(l10n.t('no.such.key'), 'no.such.key');
  });
});

test('setLocale lazy-loads once, resolves regional codes and notifies subscribers', async () => {
  let loads = 0;
  const l10n = createL10n({
    messages: { en },
    supported: ['es'],
    loadLocale: async (code) => {
      loads += 1;
      assert.equal(code, 'es');
      return es;
    },
  });
  let notified = 0;
  l10n.subscribe(() => {
    notified += 1;
  });
  assert.equal(await l10n.setLocale('es-MX'), 'es');
  assert.equal(l10n.t('hud.score', { score: 7 }), 'Puntos: 7');
  await l10n.setLocale('en');
  await l10n.setLocale('es');
  assert.equal(loads, 1);
  assert.ok(notified >= 2);
});

test('a failed load keeps the current language and does not throw', async () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const l10n = createL10n({ messages: { en }, supported: ['es'], loadLocale: async () => { throw new Error('offline'); } });
    assert.equal(await l10n.setLocale('es'), 'en');
    assert.equal(l10n.t('menu.play'), 'Play');
  } finally {
    console.warn = originalWarn;
  }
});

test('a newer setLocale call wins over a slower earlier one', async () => {
  const l10n = createL10n({
    messages: { en },
    supported: ['es', 'fr'],
    loadLocale: (code) => new Promise((resolve) => setTimeout(() => resolve(code === 'es' ? es : { 'menu.play': 'Jouer' }), code === 'es' ? 30 : 1)),
  });
  const slow = l10n.setLocale('es');
  const fast = l10n.setLocale('fr');
  await Promise.all([slow, fast]);
  assert.equal(l10n.locale, 'fr');
});

test('numeric count selects plural forms', async () => {
  const l10n = createL10n({ messages: { en, es } });
  assert.equal(l10n.t('loot.count', { count: 1 }), '1 item');
  assert.equal(l10n.t('loot.count', { count: 3 }), '3 items');
  await l10n.setLocale('es');
  assert.equal(l10n.t('loot.count', { count: 1 }), '1 objeto');
  assert.equal(l10n.t('loot.count', { count: 0 }), '0 objetos');
});

test('onMissing fires once per key and locale', () => {
  const seen = [];
  const l10n = createL10n({ messages: { en }, onMissing: (key) => seen.push(key) });
  l10n.t('nope');
  l10n.t('nope');
  assert.deepEqual(seen, ['nope']);
});

test('directionOf flags right-to-left languages', () => {
  assert.equal(directionOf('ar'), 'rtl');
  assert.equal(directionOf('he-IL'), 'rtl');
  assert.equal(directionOf('es'), 'ltr');
});
