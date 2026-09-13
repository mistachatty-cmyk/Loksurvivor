import assert from 'node:assert/strict';
import test from 'node:test';

import { CARD_MANIFESTS, cardCollectionSummary, isCardOwned } from '@/game/data/cards';
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

test('a fresh save owns only its default-unlocked characters', () => {
  const meta = createInitialMeta();
  const defaultCharacterIds = new Set(CHARACTERS.filter((c) => c.unlock.kind === 'default').map((c) => c.id));

  for (const card of CARD_MANIFESTS) {
    const owned = isCardOwned(card, meta);
    if (card.slug.startsWith('character-')) {
      const characterId = card.slug.slice('character-'.length);
      assert.equal(owned, defaultCharacterIds.has(characterId), `${card.id} ownership mismatch on a fresh save`);
    } else {
      assert.equal(owned, false, `${card.id} should not be owned on a fresh save`);
    }
  }

  const summary = cardCollectionSummary(meta);
  assert.equal(summary.total, CARD_MANIFESTS.length);
  assert.equal(summary.owned, defaultCharacterIds.size);
});

test('defeating an enemy and reaching endless milestones grant their cards', () => {
  const enemyId = 'nightcrawler';
  const meta = {
    ...createInitialMeta(),
    bestiary: { [enemyId]: 1 },
    endlessDiscoveryIds: ['core'],
    endlessRecordDistancePx: 5000,
  };

  const enemyCard = CARD_MANIFESTS.find((c) => c.slug === `enemy-${enemyId}`);
  assert.ok(enemyCard, 'expected a card for the nightcrawler enemy');
  assert.equal(isCardOwned(enemyCard!, meta), true);

  const bandCard = CARD_MANIFESTS.find((c) => c.slug === 'endless-band-core');
  assert.ok(bandCard, 'expected an endless band card for core');
  assert.equal(isCardOwned(bandCard!, meta), true);

  const milestoneCard = CARD_MANIFESTS.find((c) => c.slug === 'endless-milestone-5000');
  assert.ok(milestoneCard, 'expected a 5,000-unit endless milestone card');
  assert.equal(isCardOwned(milestoneCard!, meta), true);
});
