import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FACTIONS } from '@/game/data/factions';
import { DIGI_FLOWERS, DIGI_GARDENERS, MASTER_CALLINGS, MASTER_CALLING_BY_ID, MASTER_FIGURES, MASTER_RANKS, MASTER_RANK_BY_ID } from '@/game/data/masterLore';

const BANNED = new RegExp(['sig', 'nal'].join(''), 'i');

describe('master lore', () => {
  it('has the six ranks in a sensible order', () => {
    assert.deepEqual(MASTER_RANKS.map((r) => r.title), ['Master', 'Sector Lead', 'Sector Mage', 'Sector Master', 'Master Divine', 'Digi-Master']);
    assert.equal(new Set(MASTER_RANKS.map((r) => r.id)).size, MASTER_RANKS.length);
    assert.ok(MASTER_RANK_BY_ID['digi-master']!.order > MASTER_RANK_BY_ID['master-divine']!.order);
    assert.ok(MASTER_RANK_BY_ID['master-divine']!.order > MASTER_RANK_BY_ID['sector-master']!.order);
  });

  it('only names real ranks and factions, with unique ids', () => {
    assert.equal(new Set(MASTER_FIGURES.map((f) => f.id)).size, MASTER_FIGURES.length);
    for (const f of MASTER_FIGURES) {
      assert.ok(MASTER_RANK_BY_ID[f.rank], f.id);
      assert.ok(MASTER_CALLING_BY_ID[f.calling], `${f.id} calling`);
      if (f.faction) assert.ok(FACTIONS.some((x) => x.id === f.faction), `${f.id} -> ${f.faction}`);
      assert.ok(f.blurb.length > 10);
    }
  });

  it('gives each Tower sector exactly one Digi-Master', () => {
    const masters = MASTER_FIGURES.filter((f) => f.rank === 'digi-master');
    assert.deepEqual(masters.map((f) => f.towerSector).sort((a, b) => a! - b!), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('has leaders of every calling in both the city and the digi realm', () => {
    for (const c of MASTER_CALLINGS) {
      for (const realm of ['city', 'digi'] as const) {
        assert.ok(MASTER_FIGURES.some((f) => f.calling === c.id && f.realm === realm), `${c.id}/${realm}`);
      }
    }
    for (const f of MASTER_FIGURES.filter((x) => x.rank === 'digi-master')) assert.equal(f.realm, 'digi');
  });

  it('keeps digiflowers and their gardeners consistent', () => {
    assert.equal(new Set(DIGI_FLOWERS.map((f) => f.id)).size, DIGI_FLOWERS.length);
    assert.ok(DIGI_FLOWERS.length >= 6);
    for (const g of DIGI_GARDENERS) {
      assert.ok(g.tends.length > 0, g.id);
      for (const id of g.tends) assert.ok(DIGI_FLOWERS.some((f) => f.id === id), `${g.id} -> ${id}`);
    }
  });

  it('has every rank represented and avoids the banned word', () => {
    for (const r of MASTER_RANKS) assert.ok(MASTER_FIGURES.some((f) => f.rank === r.id), r.id);
    assert.ok(!BANNED.test(JSON.stringify([MASTER_RANKS, MASTER_CALLINGS, MASTER_FIGURES, DIGI_FLOWERS, DIGI_GARDENERS])));
  });
});
