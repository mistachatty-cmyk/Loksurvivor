import assert from 'node:assert/strict';
import test from 'node:test';

import { LOKTOKEN_ONLY_KINDS, LOKTOKEN_PRICE_BY_TIER, catalogSku } from '../../lib/lokStoreCatalog';
import { DEFAULT_DROP_PACK_ID, DROP_PACKS, DROP_PACKS_BY_ID, getDropStyle } from './dropPacks';

test('the free default is the Potato Pack and keeps the original (classic) art', () => {
  const free = DROP_PACKS.filter((pack) => pack.cost === 0);
  assert.deepEqual(free.map((pack) => pack.id), [DEFAULT_DROP_PACK_ID]);
  assert.equal(DROP_PACKS_BY_ID[DEFAULT_DROP_PACK_ID]!.name, 'Potato Pack');
  assert.equal(getDropStyle(DEFAULT_DROP_PACK_ID), 'classic');
  assert.equal(getDropStyle('missing-pack'), 'classic');
});

test('every paid drop pack has a LokToken price, a unique SKU and a unique style', () => {
  assert.ok(LOKTOKEN_ONLY_KINDS.has('dropPack'));
  const skus = new Set<string>();
  const styles = new Set<string>();
  for (const pack of DROP_PACKS) {
    assert.ok(!styles.has(pack.style), `duplicate style ${pack.style}`);
    styles.add(pack.style);
    if (pack.cost <= 0) continue;
    assert.ok((LOKTOKEN_PRICE_BY_TIER[pack.tier] ?? 0) > 0, `${pack.id} has no price`);
    const sku = catalogSku('dropPack', pack.id);
    assert.ok(!skus.has(sku), `duplicate sku ${sku}`);
    skus.add(sku);
  }
});
