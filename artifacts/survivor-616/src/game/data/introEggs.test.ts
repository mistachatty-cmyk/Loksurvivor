import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { INTRO_EGGS, eggForTyped, pickIntroEgg } from '@/game/data/introEggs';

const EN = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'locales', 'en.json'), 'utf8')) as Record<string, string>;

describe('intro easter eggs', () => {
  it('has unique ids and a locale string for every badge', () => {
    assert.equal(new Set(INTRO_EGGS.map((egg) => egg.id)).size, INTRO_EGGS.length);
    for (const egg of INTRO_EGGS) {
      assert.ok(EN[egg.titleKey], egg.titleKey);
      assert.ok(EN[egg.lineKey], egg.lineKey);
    }
  });

  it('keeps typed words unique and lowercase', () => {
    const words = INTRO_EGGS.flatMap((egg) => (egg.word ? [egg.word] : []));
    assert.equal(new Set(words).size, words.length);
    for (const word of words) assert.equal(word, word.toLowerCase());
  });

  it('pops nothing on a high roll and only weighted eggs otherwise', () => {
    assert.equal(pickIntroEgg(() => 0.99), null);
    const seen = new Set<string>();
    let n = 0;
    const rng = () => ((n += 1) % 2 === 1 ? 0 : (n * 0.37) % 1);
    for (let i = 0; i < 200; i += 1) {
      const egg = pickIntroEgg(rng);
      if (egg) seen.add(egg.id);
    }
    assert.ok(!seen.has('ten-hit-combo'));
    assert.ok(seen.size > 1);
  });

  it('matches a typed word at the end of the text', () => {
    assert.equal(eggForTyped('xxl13gend')?.id, 'perfect-legend');
    assert.equal(eggForTyped('l13gendx'), null);
  });
});
