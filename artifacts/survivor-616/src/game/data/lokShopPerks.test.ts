import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LOKSERVER_GREETINGS, LOKSERVER_REACTIONS, lokServerGreeting } from '@/game/data/lokServer';
import {
  FEATHER_CHARMS, LOK_SHOP_PERKS, backRoomOpen, haggleAttemptsPerDay, perkEffects, rapportTier, resolveHaggle,
} from '@/game/data/lokShopPerks';
import { LOKTOKEN_ONLY_KINDS, catalogSku } from '@/lib/lokStoreCatalog';
import { createRng } from '@/game/engine/math';

const BANNED = new RegExp(['sig', 'nal'].join(''), 'i');

describe('LokShop perks', () => {
  it('has unique ids, LokToken-only skus and kid-safe text', () => {
    assert.equal(new Set(LOK_SHOP_PERKS.map((p) => p.id)).size, LOK_SHOP_PERKS.length);
    assert.ok(LOKTOKEN_ONLY_KINDS.has('perkUnlock'));
    assert.equal(new Set(LOK_SHOP_PERKS.map((p) => catalogSku(p.kind, p.id))).size, LOK_SHOP_PERKS.length);
    const text = [...LOK_SHOP_PERKS.flatMap((p) => [p.name, p.description]), ...FEATHER_CHARMS.flatMap((c) => [c.name, c.blurb]),
      ...Object.values(LOKSERVER_GREETINGS).flat(), ...Object.values(LOKSERVER_REACTIONS).flat()].join(' ');
    assert.doesNotMatch(text, BANNED);
  });

  it('lifetime passport counts as pass and passport', () => {
    assert.deepEqual(perkEffects(['lifetime-passport']), { passport: true, pass: true });
    assert.equal(haggleAttemptsPerDay([]), 1);
    assert.equal(haggleAttemptsPerDay(['lok-pass']), 3);
  });

  it('rapport tiers and back room gate', () => {
    assert.equal(rapportTier(0).id, 'stranger');
    assert.equal(rapportTier(15).id, 'favorite');
    assert.equal(rapportTier(99).next, null);
    assert.equal(backRoomOpen(0, []), false);
    assert.equal(backRoomOpen(15, []), true);
    assert.equal(backRoomOpen(0, ['lok-pass']), true);
  });

  it('haggle pays more on a win and never repeats a charm', () => {
    assert.equal(resolveHaggle(1, 0, [], [], createRng(1)).rapport, 1);
    assert.equal(resolveHaggle(1, 0, [], [], createRng(1)).charmId, null);
    const all = FEATHER_CHARMS.map((c) => c.id);
    assert.equal(resolveHaggle(2, 2, all, ['lok-passport'], () => 0).charmId, null);
    const win = resolveHaggle(2, 2, [], [], () => 0);
    assert.equal(win.rapport, 3);
    assert.ok(win.charmId);
  });

  it('greets by relationship', () => {
    const base = { rapportTier: 'regular', firstVisit: false, stamps: 0, charms: 1, charmTotal: 6, hasPassport: false, ownedPerks: 0 } as const;
    assert.ok(lokServerGreeting({ ...base, firstVisit: true }, () => 0).line.length > 0);
    assert.equal(lokServerGreeting({ ...base, charms: 6 }, () => 0).mood, 'pleased');
  });
});
