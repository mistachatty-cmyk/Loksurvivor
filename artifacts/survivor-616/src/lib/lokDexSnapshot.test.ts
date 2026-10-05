import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CARD_MANIFESTS_BY_ID } from '@/game/data/cards';
import { LOKPET_VARIANTS } from '@/game/data/lokPets';
import type { SavedLokPet } from '@/game/types';
import { buildLokDexSnapshot, lokDexSnapshotFingerprint } from './lokDexSnapshot';

const base = { cardCollection: [], savedLokPets: [] } as Parameters<typeof buildLokDexSnapshot>[0];

const variant = LOKPET_VARIANTS[0]!;

function pet(overrides: Partial<SavedLokPet> = {}): SavedLokPet {
  return {
    id: 'pet-1',
    stamina: 1,
    roll: { name: variant.name, variantId: variant.id, family: variant.family, silhouette: variant.silhouette, palette: variant.palette, rarity: 'charged' } as SavedLokPet['roll'],
    ...overrides,
  };
}

test('only owned cards are published, with best finish only when it is not standard', () => {
  const meta = { ...base, cardCollection: [
    { cardId: 'b', copies: 2, variants: { foil: 1 }, bestVariant: 'foil' as const, totalValue: 0 },
    { cardId: 'a', copies: 1, variants: {}, bestVariant: 'standard' as const, totalValue: 0 },
    { cardId: 'gone', copies: 0, variants: {}, bestVariant: 'standard' as const, totalValue: 0 },
  ] };
  const snapshot = buildLokDexSnapshot(meta, 5);
  assert.deepEqual(snapshot.cards, [{ id: 'a', copies: 1 }, { id: 'b', copies: 2, best: 'foil' }]);
  assert.equal(snapshot.updatedAt, 5);
  assert.equal(snapshot.schema, 'lok.dex-snapshot');
});

test('a pet resolves to a catalog card and prefers the player-given name, capped in length', () => {
  const meta = { ...base, savedLokPets: [pet({ name: 'x'.repeat(60), level: 12, starter: true })] };
  const [published] = buildLokDexSnapshot(meta).pets;
  assert.ok(CARD_MANIFESTS_BY_ID[published!.speciesId], 'speciesId must match a card the hub catalog has');
  assert.equal(published!.name.length, 24);
  assert.equal(published!.level, 12);
  assert.equal(published!.rarity, 'uncommon');
  assert.equal(published!.starter, true);
});

test('the fingerprint ignores the timestamp so unchanged collections skip the upload', () => {
  const meta = { ...base, savedLokPets: [pet()] };
  assert.equal(
    lokDexSnapshotFingerprint(buildLokDexSnapshot(meta, 1)),
    lokDexSnapshotFingerprint(buildLokDexSnapshot(meta, 999)),
  );
  const changed = { ...meta, savedLokPets: [pet({ level: 2 })] };
  assert.notEqual(lokDexSnapshotFingerprint(buildLokDexSnapshot(meta)), lokDexSnapshotFingerprint(buildLokDexSnapshot(changed)));
});
