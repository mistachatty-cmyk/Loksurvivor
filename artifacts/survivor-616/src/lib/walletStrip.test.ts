import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { walletStripState } from '../../../../lib/lok-universe/src/wallet';

const EN = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'locales', 'en.json'), 'utf8')) as Record<string, string>;

describe('wallet strip state', () => {
  it('covers every situation a shop can be in', () => {
    assert.deepEqual(walletStripState({ signedIn: true, balance: 1250.9, authAvailable: true }), { kind: 'signed-in', balance: 1250 });
    assert.deepEqual(walletStripState({ signedIn: true, balance: 0, authAvailable: true }), { kind: 'signed-in', balance: 0 });
    assert.deepEqual(walletStripState({ signedIn: true, balance: null, authAvailable: true }), { kind: 'loading' });
    assert.deepEqual(walletStripState({ signedIn: false, balance: null, authAvailable: true }), { kind: 'sign-in' });
    assert.deepEqual(walletStripState({ signedIn: false, balance: null, authAvailable: false }), { kind: 'offline' });
  });

  it('has the copy the strip renders', () => {
    for (const key of ['wallet.balance', 'wallet.rank', 'wallet.loading', 'wallet.signedOut', 'wallet.offline', 'wallet.signIn']) assert.ok(EN[key], key);
  });
});
