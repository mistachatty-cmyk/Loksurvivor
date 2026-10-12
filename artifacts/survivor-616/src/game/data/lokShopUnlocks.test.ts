import assert from 'node:assert/strict';
import test from 'node:test';

import { LOKTOKEN_ONLY_KINDS } from '@/lib/lokStoreCatalog';
import { LOK_SHOP_UNLOCKS } from './lokShopUnlocks';

test('every Lok Shop feature unlock has a unique id, a LokToken-only kind and a positive price', () => {
  const ids = new Set<string>();
  const kinds = new Set<string>();
  for (const unlock of LOK_SHOP_UNLOCKS) {
    assert.ok(!ids.has(unlock.id), `duplicate id ${unlock.id}`);
    ids.add(unlock.id);
    assert.ok(!kinds.has(unlock.kind), `duplicate kind ${unlock.kind} -- each unlock needs its own StoreItemKind`);
    kinds.add(unlock.kind);
    assert.ok(LOKTOKEN_ONLY_KINDS.has(unlock.kind), `${unlock.id} must be LokToken-only`);
    assert.ok(unlock.cost > 0, `${unlock.id} needs a positive price`);
  }
});
