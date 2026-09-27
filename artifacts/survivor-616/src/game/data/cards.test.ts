import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CARD_MANIFESTS,
  CARD_PACKS,
  LOK_DECK_CATALOG,
  cardCollectionSummary,
  isCardOwned,
  type LokDeckCardMetadata,
} from '@/game/data/cards';
import { CHARACTERS } from '@/game/data/characters';
import { createInitialMeta } from '@/game/state/metaStore';
import { G6_616_SURVIVOR_NAMESPACE } from '@/game/lok/types';

test('card ids are unique, namespaced, and schema-valid', () => {
  assert.equal(new Set(CARD_MANIFESTS.map((c) => c.id)).size, CARD_MANIFESTS.length);
  for (const card of CARD_MANIFESTS) {
    assert.equal(card.schema, 'lok.asset');
    assert.equal(card.schemaVersion, 1);
    assert.equal(card.namespace, G6_616_SURVIVOR_NAMESPACE);
    assert.equal(card.id, `${card.namespace}:${card.slug}`);
    assert.equal(card.provenance.sourceGame, '616-survivor');
    assert.ok(card.acquisition.length > 0, `${card.id} has no acquisition method`);
  }
});

test('a fresh save begins with a sealed binder', () => {
  const meta = createInitialMeta();
  for (const card of CARD_MANIFESTS) {
    assert.equal(isCardOwned(card, meta), false, `${card.id} should not be owned on a fresh save`);
  }

  const summary = cardCollectionSummary(meta);
  assert.equal(summary.total, CARD_MANIFESTS.length);
  assert.equal(summary.owned, 0);
});

test('progress reveals subjects but only explicit pack copies grant cards', () => {
  const enemyId = 'nightcrawler';
  const meta = {
    ...createInitialMeta(),
    bestiary: { [enemyId]: 1 },
    endlessDiscoveryIds: ['core'],
    endlessRecordDistancePx: 5000,
  };

  const enemyCard = CARD_MANIFESTS.find((c) => c.slug === `enemy-${enemyId}`);
  assert.ok(enemyCard, 'expected a card for the nightcrawler enemy');
  assert.equal(isCardOwned(enemyCard, meta), false);

  const bandCard = CARD_MANIFESTS.find((c) => c.slug === 'endless-band-core');
  assert.ok(bandCard, 'expected an endless band card for core');
  assert.equal(isCardOwned(bandCard, meta), false);

  const milestoneCard = CARD_MANIFESTS.find((c) => c.slug === 'endless-milestone-5000');
  assert.ok(milestoneCard, 'expected a 5,000-unit endless milestone card');
  assert.equal(isCardOwned(milestoneCard, meta), false);
  const collected = { ...meta, cardCollection: [{ cardId: enemyCard.id, copies: 2, variants: { standard: 1, foil: 1 }, bestVariant: 'foil' as const, totalValue: 3 }] };
  assert.equal(isCardOwned(enemyCard, collected), true);
});

test('Lock Deck catalog has stable unique IDs, card numbers, and one pack per card', () => {
  assert.equal(LOK_DECK_CATALOG.schema, 'lok.deck-catalog');
  assert.equal(LOK_DECK_CATALOG.schemaVersion, 1);
  assert.equal(new Set(CARD_MANIFESTS.map((card) => card.id)).size, CARD_MANIFESTS.length);

  const allPackedIds = CARD_PACKS.flatMap((pack) => pack.cardIds);
  assert.equal(allPackedIds.length, CARD_MANIFESTS.length);
  assert.equal(new Set(allPackedIds).size, CARD_MANIFESTS.length);

  const cardNumbers = CARD_MANIFESTS.map((card) => (card.metadata as LokDeckCardMetadata).cardNumber);
  assert.equal(cardNumbers.every(Boolean), true);
  assert.equal(new Set(cardNumbers).size, CARD_MANIFESTS.length);
});

test('operative cards identify their playable Survivor 616 subjects', () => {
  const operatives = CARD_MANIFESTS.filter((card) => (card.metadata as LokDeckCardMetadata).setId === 'operatives');
  assert.ok(operatives.length > 0);
  assert.equal(operatives.every((card) => {
    const info = card.metadata as LokDeckCardMetadata;
    return info.subjectType === 'character' && info.playableInSurvivor616 && card.visual?.previewKey === `character:${info.subjectId}`;
  }), true);
});
