import assert from 'node:assert/strict';
import test from 'node:test';

import { createInitialMeta, normalizeMeta, reducer } from '../state/metaStore';
import { CHARACTERS_BY_ID } from './characters';
import {
  ALL_CARD_COSMETICS,
  BACK_HUB_FIGURE,
  CARD_BACKS,
  CARD_COSMETIC_COST,
  CARD_COSMETICS_BY_ID,
  LIVE_PACK_SKINS,
  CARD_FRAMES,
  PACK_FEATURED,
  PACK_SKINS,
  RETRO_WALKERS,
  WRAP_FINISH_BY_SKIN,
  boxShellFor,
  cardLayoutForFrame,
  foilStyleFor,
  isStarterCosmetic,
  normalizeCardCosmetics,
  packLotNumber,
  type FeaturedFigure,
} from './cardCosmetics';
import { LOKPET_VARIANTS } from './lokPets';
import { CARD_SHOP_PACKS } from './passiveCards';

const figureExists = (figure: FeaturedFigure) =>
  figure.kind === 'character' ? Boolean(CHARACTERS_BY_ID[figure.id]) : LOKPET_VARIANTS.some((variant) => variant.id === figure.id);

test('cosmetic ids are unique and prefixed by kind', () => {
  const ids = ALL_CARD_COSMETICS.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const item of PACK_SKINS) assert.ok(item.id.startsWith('pack-'), item.id);
  for (const item of CARD_BACKS) assert.ok(item.id.startsWith('back-'), item.id);
  for (const item of CARD_FRAMES) assert.ok(item.id.startsWith('frame-'), item.id);
});

test('each kind has exactly one free starter and everything else costs Card Credits', () => {
  for (const group of [PACK_SKINS, CARD_BACKS, CARD_FRAMES]) {
    assert.equal(group.filter((item) => item.cost === 0).length, 1);
    for (const item of group) if (item.cost > 0) assert.ok(item.cost >= 30);
  }
});

test('featured fighters, back hubs and every shop pack resolve to real game content', () => {
  for (const [packId, figure] of Object.entries(PACK_FEATURED)) {
    assert.ok(figure && figureExists(figure), `pack ${packId} features missing ${figure?.kind} ${figure?.id}`);
  }
  for (const [backId, figure] of Object.entries(BACK_HUB_FIGURE)) {
    assert.ok(CARD_COSMETICS_BY_ID[backId], `${backId} is not a catalog back`);
    assert.ok(figureExists(figure), `${backId} hub figure ${figure.id} is missing`);
  }
  for (const pack of CARD_SHOP_PACKS) {
    assert.ok(PACK_FEATURED[pack.id], `${pack.id} has no featured fighter`);
    assert.ok(foilStyleFor(pack.id).a.startsWith('#'), `${pack.id} has no foil style`);
    assert.ok(['walnut', 'hazard', 'ice'].includes(boxShellFor(pack.id)));
  }
});

test('frame ids map to the right card layout', () => {
  assert.equal(cardLayoutForFrame('frame-printed'), 'printed');
  assert.equal(cardLayoutForFrame('frame-tcg'), 'tcg');
  assert.equal(cardLayoutForFrame('frame-classic'), 'binder');
  assert.equal(cardLayoutForFrame(undefined), 'binder');
});

test('pack lot numbers are stable', () => {
  assert.equal(packLotNumber('operative'), packLotNumber('operative'));
  assert.match(packLotNumber('cipher'), /^616-\d{3}$/);
});

test('a fresh or old save starts with only the free starters equipped', () => {
  const meta = normalizeMeta({ version: 1 });
  assert.deepEqual(meta.cardFrameSleeves, ['frame-classic']);
  assert.deepEqual(meta.ownedCardBackIds, ['back-default']);
  assert.deepEqual(meta.ownedPackSkinIds, ['pack-classic']);
  assert.equal(meta.selectedCardFrame, 'frame-classic');
  assert.equal(meta.selectedCardBack, 'back-default');
  assert.equal(meta.selectedPackSkin, 'pack-classic');
  assert.equal(meta.cardMotion, 'subtle');
});

test('loading drops unknown ids and refuses to equip something unowned', () => {
  const cleaned = normalizeCardCosmetics({
    ownedCardBackIds: ['back-walnut', 'back-from-the-future', 7],
    selectedCardBack: 'back-iron',
    selectedPackSkin: 'pack-printed',
    cardFrameSleeves: ['frame-tcg'],
    selectedCardFrame: 'frame-tcg',
  });
  assert.deepEqual(cleaned.ownedCardBackIds, ['back-default', 'back-walnut']);
  assert.equal(cleaned.selectedCardBack, 'back-default');
  assert.equal(cleaned.selectedPackSkin, 'pack-classic');
  assert.deepEqual(cleaned.cardFrameSleeves, ['frame-classic', 'frame-tcg']);
  assert.equal(cleaned.selectedCardFrame, 'frame-tcg');
  assert.ok(isStarterCosmetic('back-default'));
});

test('buying a cosmetic spends Card Credits once and equipping requires ownership', () => {
  const state = { meta: { ...createInitialMeta(), cardCredits: 100 }, lastRun: null };
  const price = CARD_COSMETICS_BY_ID['pack-foil']!.cost;

  const early = reducer(state, { type: 'equipCardCosmetic', id: 'pack-foil' });
  assert.equal(early.meta.selectedPackSkin, 'pack-classic');

  const bought = reducer(state, { type: 'buyCardCosmetic', id: 'pack-foil' });
  assert.equal(bought.meta.cardCredits, 100 - price);
  assert.ok(bought.meta.ownedPackSkinIds.includes('pack-foil'));

  const again = reducer(bought, { type: 'buyCardCosmetic', id: 'pack-foil' });
  assert.equal(again.meta.cardCredits, bought.meta.cardCredits);

  const equipped = reducer(bought, { type: 'equipCardCosmetic', id: 'pack-foil' });
  assert.equal(equipped.meta.selectedPackSkin, 'pack-foil');
});

test('a cosmetic you cannot afford is not granted, and unknown ids are ignored', () => {
  const state = { meta: { ...createInitialMeta(), cardCredits: 5 }, lastRun: null };
  assert.equal(reducer(state, { type: 'buyCardCosmetic', id: 'frame-tcg' }).meta.cardCredits, 5);
  assert.equal(reducer(state, { type: 'buyCardCosmetic', id: 'frame-tcg' }).meta.cardFrameSleeves.includes('frame-tcg'), false);
  assert.equal(reducer(state, { type: 'buyCardCosmetic', id: 'nope' }), state);
});

test('card motion setting round-trips and falls back to subtle', () => {
  const state = { meta: createInitialMeta(), lastRun: null };
  assert.equal(reducer(state, { type: 'setCardMotion', motion: 'off' }).meta.cardMotion, 'off');
  assert.equal(normalizeMeta({ version: 1, cardMotion: 'full' }).cardMotion, 'full');
  assert.equal(normalizeMeta({ version: 1, cardMotion: 'wild' as never }).cardMotion, 'subtle');
});

test('wrap finishes and the Retro Neon walkers point at real catalog skins and real game figures', () => {
  for (const skinId of Object.keys(WRAP_FINISH_BY_SKIN)) {
    assert.equal(CARD_COSMETICS_BY_ID[skinId]?.kind, 'packSkin', `${skinId} is not a pack skin`);
  }
  for (const skinId of ['pack-retro', 'pack-kraft', 'pack-stock']) assert.ok(CARD_COSMETICS_BY_ID[skinId], `${skinId} missing`);
  assert.ok(RETRO_WALKERS.length >= 2);
  for (const figure of RETRO_WALKERS) assert.ok(figureExists(figure), `walker ${figure.id} is missing`);
});

test('Live wraps are the animated tier, cost double a legendary wrap, and need the LokPack Visualizer', () => {
  assert.equal(CARD_COSMETIC_COST.animated, 480);
  assert.equal(CARD_COSMETIC_COST.animated, CARD_COSMETIC_COST.legendary * 2);
  assert.deepEqual([...LIVE_PACK_SKINS].sort(), ['pack-holo-live', 'pack-retro-arcade', 'pack-retro-live']);
  for (const skinId of LIVE_PACK_SKINS) {
    const item = CARD_COSMETICS_BY_ID[skinId]!;
    assert.equal(item.tier, 'animated', skinId);
    assert.equal(item.cost, 480, skinId);
    assert.equal(item.requiresUnlock, 'lokPackVisualizer', skinId);
  }
  for (const skinId of ['pack-holo', 'pack-retro', 'pack-gold', 'pack-stock']) assert.equal(CARD_COSMETICS_BY_ID[skinId]!.requiresUnlock, undefined, skinId);
});

test('a Live wrap cannot be bought until the LokPack Visualizer is unlocked, and unlocking never double-grants', () => {
  const base = { meta: { ...createInitialMeta(), cardCredits: 2000 }, lastRun: null } as any;
  assert.equal(reducer(base, { type: 'buyCardCosmetic', id: 'pack-holo-live' }), base);
  const unlocked = reducer(base, { type: 'grantLokPackVisualizer' }) as any;
  assert.equal(unlocked.meta.lokPackVisualizerUnlocked, true);
  assert.equal(reducer(unlocked, { type: 'grantLokPackVisualizer' }), unlocked);
  const bought = reducer(unlocked, { type: 'buyCardCosmetic', id: 'pack-holo-live' }) as any;
  assert.ok(bought.meta.ownedPackSkinIds.includes('pack-holo-live'));
  assert.equal(bought.meta.cardCredits, 2000 - 480);
  const reloaded = normalizeMeta(JSON.parse(JSON.stringify(bought.meta)));
  assert.equal(reloaded.lokPackVisualizerUnlocked, true);
  assert.equal(normalizeMeta({}).lokPackVisualizerUnlocked, false);
});
