import assert from 'node:assert/strict';
import test from 'node:test';
import { CARD_SHOP_PACKS, PASSIVE_CARDS, activeCardEffects, mergeCardPulls, passiveDeckSlots, rollCardPack } from './passiveCards';
import { createInitialMeta, normalizeMeta, reducer } from '@/game/state/metaStore';
import { createRng } from '@/game/engine/math';

test('passive catalog has two card types, stable unique ids, and no weapons', () => { assert.ok(PASSIVE_CARDS.length >= 32); assert.deepEqual(new Set(PASSIVE_CARDS.map((card) => card.type)), new Set(['scenario', 'lokpet'])); assert.equal(new Set(PASSIVE_CARDS.map((card) => card.id)).size, PASSIVE_CARDS.length); assert.equal(PASSIVE_CARDS.some((card) => card.tags.includes('weapon')), false); });
test('packs yield duplicates, variants, and accumulated value', () => { const pulls = rollCardPack('cipher', createRng(616)); const doubled = mergeCardPulls(mergeCardPulls([], pulls), pulls); assert.equal(pulls.length, 3); assert.equal(doubled.reduce((sum, card) => sum + card.copies, 0), 6); assert.ok(doubled.every((card) => card.totalValue >= card.copies)); });
test('Roster Roll targets characters and LokPacks target pet cards', () => { const subjects = ['g6.616-survivor:character-shade', 'g6.616-survivor:pet-stray', 'g6.616-survivor:enemy-nightcrawler']; assert.ok(rollCardPack('operative', createRng(1), subjects).every((pull) => pull.cardId.includes(':character-'))); assert.ok(Array.from({ length: 20 }, (_, seed) => rollCardPack('lokpet', createRng(seed), subjects)).flat().every((pull) => pull.cardId.includes('.lokpet-') || pull.cardId.includes(':pet-'))); });
test('deck unlocks from three to five slots through Collector play', () => { assert.equal(passiveDeckSlots(createInitialMeta()), 3); assert.equal(passiveDeckSlots({ ...createInitialMeta(), lokCollectorRuns: 8 }), 4); assert.equal(passiveDeckSlots({ ...createInitialMeta(), lokCollectorPetsFound: 20 }), 5); });
test('only owned equipped cards affect runs and normalization drops injected ids', () => { const card = PASSIVE_CARDS.find((entry) => entry.effect.lokPetDamageMult)!; const collection = mergeCardPulls([], [{ cardId: card.id, variant: 'foil', value: 2 }]); const meta = { ...createInitialMeta(), cardCollection: collection, activePassiveCardIds: [card.id, 'not-a-card'] }; assert.ok(activeCardEffects(meta).lokPetDamageMult > 1); assert.deepEqual(normalizeMeta(meta).activePassiveCardIds, [card.id]); });
test('shop packs cost currency and cannot overspend', () => { assert.ok(CARD_SHOP_PACKS.every((pack) => pack.cost > 0 && pack.cards > 0)); const state = { meta: createInitialMeta(), lastRun: null, lastCardPackReveal: null }; assert.equal(reducer(state, { type: 'buyCardPack', packId: 'cipher', now: 1 }), state); });
test('buying a pack with auto-open off stores it sealed instead of opening it', () => {
  const meta = { ...createInitialMeta(), cardCredits: 100, autoOpenPacksEnabled: false };
  const state = { meta, lastRun: null, lastCardPackReveal: null };
  const next = reducer(state, { type: 'buyCardPack', packId: 'street', now: 1 });
  assert.equal(next.meta.cardCredits, 100 - 8);
  assert.equal(next.meta.unopenedCardPacks.street, 1);
  assert.equal(next.lastCardPackReveal, null);
  assert.equal(next.meta.cardCollection.length, 0);
});
test('opening a stored pack decrements storage, rolls cards, and sets the reveal', () => {
  const meta = { ...createInitialMeta(), unopenedCardPacks: { street: 2 } };
  const state = { meta, lastRun: null, lastCardPackReveal: null };
  const next = reducer(state, { type: 'openStoredCardPack', packId: 'street', now: 1 });
  assert.equal(next.meta.unopenedCardPacks.street, 1);
  assert.ok(next.lastCardPackReveal);
  assert.equal(next.lastCardPackReveal!.packId, 'street');
  assert.equal(next.meta.cardCollection.reduce((sum, card) => sum + card.copies, 0), 1);
});
test('opening a stored pack with none left is a no-op', () => {
  const state = { meta: createInitialMeta(), lastRun: null, lastCardPackReveal: null };
  assert.equal(reducer(state, { type: 'openStoredCardPack', packId: 'street', now: 1 }), state);
});
test('setAutoOpenPacksEnabled toggles the meta flag', () => {
  const state = { meta: createInitialMeta(), lastRun: null, lastCardPackReveal: null };
  const next = reducer(state, { type: 'setAutoOpenPacksEnabled', enabled: false });
  assert.equal(next.meta.autoOpenPacksEnabled, false);
});
