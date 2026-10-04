import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialMeta } from './state/metaStore';
import { getCollectorMastery, COLLECTOR_RANKS } from './data/collectorMastery';
import { CARD_MANIFESTS } from './data/cards';

test('collector mastery starts at Rank 1 Scrap Runner for empty collection', () => {
  const meta = createInitialMeta();
  const mastery = getCollectorMastery(meta);

  assert.equal(mastery.currentRank.level, 1);
  assert.equal(mastery.currentRank.title, 'Scrap Runner');
  assert.equal(mastery.uniqueCount, 0);
  assert.equal(mastery.nextRank?.level, 2);
  assert.equal(mastery.cardsUntilNext, 10);
  assert.equal(mastery.progressPercent, 0);
});

test('collector mastery scales with unique owned cards and unlocks higher ranks', () => {
  const meta = createInitialMeta();

  // Add 12 unique cards
  meta.cardCollection = CARD_MANIFESTS.slice(0, 12).map((c, i) => ({
    cardId: c.id,
    copies: 2,
    variants: { standard: 1, holo: 1 },
    bestVariant: 'holo',
    totalValue: 13,
  }));

  const mastery = getCollectorMastery(meta);
  assert.equal(mastery.uniqueCount, 12);
  assert.equal(mastery.totalCopies, 24);
  assert.equal(mastery.holoCount, 12);
  assert.equal(mastery.currentRank.level, 2);
  assert.equal(mastery.currentRank.title, 'District Sifter');
  assert.equal(mastery.nextRank?.level, 3);
  assert.equal(mastery.cardsUntilNext, 13); // 25 - 12
});

test('collector mastery hits max rank at 75+ unique cards', () => {
  const meta = createInitialMeta();

  // Add 80 unique cards
  meta.cardCollection = CARD_MANIFESTS.slice(0, 80).map((c) => ({
    cardId: c.id,
    copies: 1,
    variants: { standard: 1 },
    bestVariant: 'standard',
    totalValue: 1,
  }));

  const mastery = getCollectorMastery(meta);
  assert.equal(mastery.currentRank.level, 5);
  assert.equal(mastery.currentRank.title, 'Grand Master of 616');
  assert.equal(mastery.nextRank, null);
  assert.equal(mastery.progressPercent, 100);
  assert.equal(mastery.cardsUntilNext, 0);
});
