import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { COMMANDS, commandMessageKeys, runChatCommand, textUnit } from './chatCommands';

const env = (value = 0.5) => ({ rng: () => value, now: new Date('2026-10-22T15:00:00') });
const say = (text: string, value = 0.5) => {
  const result = runChatCommand(text, env(value));
  assert.equal(result?.kind, 'say', text);
  return result as Extract<NonNullable<typeof result>, { kind: 'say' }>;
};

test('plain text is not a command', () => {
  assert.equal(runChatCommand('hello there', env()), null);
  assert.equal(runChatCommand('  not /roll', env()), null);
});

test('unknown commands say so and bare slash shows help', () => {
  assert.equal(say('/nope').key, 'lokChat.cmd.unknown');
  assert.equal(say('/').key, 'lokChat.cmd.help');
});

test('roll handles dice, defaults and bad input', () => {
  const one = say('/roll');
  assert.equal(one.key, 'lokChat.cmd.roll.one');
  assert.equal(one.params?.dice, '1d20');
  const many = say('/roll 3d6', 0);
  assert.equal(many.key, 'lokChat.cmd.roll.many');
  assert.equal(many.params?.total, 3);
  assert.equal(say('/roll 99d6').key, 'lokChat.cmd.roll.usage');
  assert.equal(say('/roll d1').key, 'lokChat.cmd.roll.usage');
  assert.equal(say('/roll banana').key, 'lokChat.cmd.roll.usage');
  const top = say('/roll d20', 0.999999);
  assert.equal(top.params?.total, 20);
});

test('rock paper scissors resolves every pairing', () => {
  const cases: Array<[string, number, string]> = [
    ['rock', 0, 'tie'], ['rock', 0.4, 'lose'], ['rock', 0.9, 'win'],
    ['paper', 0, 'win'], ['scissors', 0, 'lose'],
  ];
  for (const [mine, value, outcome] of cases) assert.equal(say(`/rps ${mine}`, value).key, `lokChat.cmd.rps.${outcome}`, `${mine} @ ${value}`);
  assert.equal(say('/rps lizard').key, 'lokChat.cmd.rps.usage');
});

test('pick, ask, rate and me need an argument', () => {
  assert.equal(say('/pick tacos, pizza or soup', 0.99).params?.choice, 'soup');
  assert.equal(say('/pick lonely').key, 'lokChat.cmd.pick.usage');
  assert.equal(say('/8ball').key, 'lokChat.cmd.ball.usage');
  assert.match(say('/8ball will it rain').key, /^lokChat\.cmd\.ball\.\d$/);
  assert.equal(say('/rate').key, 'lokChat.cmd.rate.usage');
  assert.equal(say('/me waves').params?.text, 'waves');
});

test('rate is stable for the same thing', () => {
  assert.equal(say('/rate Pizza', 0.1).params?.score, say('/rate pizza', 0.9).params?.score);
  assert.ok(textUnit('x') >= 0 && textUnit('x') < 1);
});

test('time names the part of the day', () => {
  assert.equal(say('/time').key, 'lokChat.cmd.time.day');
});

test('app commands return actions', () => {
  assert.deepEqual(runChatCommand('/mail', env()), { kind: 'open', view: 'mail' });
  assert.deepEqual(runChatCommand('/clear', env()), { kind: 'clear' });
  assert.deepEqual(runChatCommand('/disco', env()), { kind: 'fx', fx: 'disco' });
});

test('command names never collide', () => {
  const names = COMMANDS.flatMap((command) => command.names);
  assert.equal(new Set(names).size, names.length);
});

test('every message key the commands can return exists in en.json', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const en = JSON.parse(readFileSync(path.resolve(here, '../../locales/en.json'), 'utf8')) as Record<string, string>;
  for (const key of commandMessageKeys()) assert.ok(typeof en[key] === 'string', `missing ${key}`);
  assert.ok(!JSON.stringify(Object.entries(en).filter(([key]) => key.startsWith('lokChat.cmd'))).toLowerCase().includes('signal'));
});
