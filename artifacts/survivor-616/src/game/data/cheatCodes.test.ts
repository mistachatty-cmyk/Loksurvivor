import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CHEAT_CODES, MASTER_CHEAT_PHRASE, findCheat, normalizeCheatInput, resolveCheat } from './cheatCodes';

test('normalizeCheatInput ignores case, spaces and punctuation', () => {
  assert.equal(normalizeCheatInput('  I Love Your Merci! '), 'iloveyourmerci');
});

test('the master phrase is the only code that opens dev access', () => {
  const master = findCheat(MASTER_CHEAT_PHRASE);
  assert.equal(master?.effect.kind, 'devAccess');
  assert.equal(CHEAT_CODES.filter((code) => code.effect.kind === 'devAccess').length, 1);
  assert.equal(resolveCheat('I love your merci', false).status, 'ready');
});

test('resource and unlock cheats stay locked until dev access is on', () => {
  assert.equal(resolveCheat('showmethemoney', false).status, 'locked');
  assert.equal(resolveCheat('showmethemoney', true).status, 'ready');
  assert.equal(resolveCheat('unlockeverything', false).status, 'locked');
});

test('easter eggs answer without dev access', () => {
  for (const phrase of ['konami', 'confetti', 'disco', '616']) {
    assert.equal(resolveCheat(phrase, false).status, 'ready', phrase);
  }
});

test('normal chat is never treated as a cheat', () => {
  assert.equal(resolveCheat('hello there', true).status, 'none');
  assert.equal(resolveCheat('', true).status, 'none');
});

test('there are at least a dozen codes besides the master phrase', () => {
  assert.ok(CHEAT_CODES.filter((code) => code.group !== 'master').length >= 12);
});

test('ids are unique and no two codes share a phrase', () => {
  const ids = new Set(CHEAT_CODES.map((code) => code.id));
  assert.equal(ids.size, CHEAT_CODES.length);
  const phrases = CHEAT_CODES.flatMap((code) => code.phrases);
  assert.equal(new Set(phrases).size, phrases.length);
  for (const phrase of phrases) assert.equal(phrase, normalizeCheatInput(phrase), `phrase "${phrase}" must be pre-normalized`);
});

test('every grant is positive and only the cheat flavours that need dev access are gated', () => {
  for (const code of CHEAT_CODES) {
    if (code.effect.kind === 'grant') {
      assert.ok(code.requiresDevAccess, code.id);
      for (const amount of Object.values(code.effect.amounts)) assert.ok((amount ?? 0) > 0, code.id);
    }
    if (code.effect.kind === 'allUnlocks') assert.ok(code.requiresDevAccess, code.id);
    if (code.group === 'fun') assert.equal(code.requiresDevAccess, false, code.id);
  }
});

test('no phrase uses the retired naming', () => {
  for (const code of CHEAT_CODES) assert.ok(!JSON.stringify(code).toLowerCase().includes('signal'));
});
