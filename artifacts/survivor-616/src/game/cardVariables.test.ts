import assert from 'node:assert/strict';
import test from 'node:test';

import { CARD_MANIFESTS } from './data/cards';
import {
  getCardVariableProfile,
  calculateDeckSynergies,
  generateVariableMatrix,
  ELEMENT_METADATA,
  DATA_TYPE_METADATA,
  FIGHTING_STYLE_METADATA,
  type CardElement,
} from './data/cardVariables';
import { LOKPET_VARIANTS, lokPetRig, getLokPetEvolutionTitle } from './data/lokPets';
import { createInitialMeta } from './state/metaStore';

test('every card in CARD_MANIFESTS has a rich variable profile with stats and moves', () => {
  for (const card of CARD_MANIFESTS) {
    const profile = getCardVariableProfile(card);
    assert.ok(profile.element, `Card ${card.id} missing element`);
    assert.ok(ELEMENT_METADATA[profile.element], `Element metadata for ${profile.element} missing`);
    assert.ok(profile.dataType, `Card ${card.id} missing dataType`);
    assert.ok(DATA_TYPE_METADATA[profile.dataType], `Data type metadata for ${profile.dataType} missing`);
    assert.ok(profile.fightingStyle, `Card ${card.id} missing fightingStyle`);
    assert.ok(FIGHTING_STYLE_METADATA[profile.fightingStyle], `Fighting style metadata missing`);
    assert.ok(profile.specialPower && profile.specialPower.name, `Special power missing`);
    assert.ok(profile.specialPowers.length >= 1, 'Must have at least one special power');
    assert.ok(profile.elements.length >= 1, 'Must have at least one element');
    assert.ok(profile.dataTypes.length >= 1, 'Must have at least one data type');
    assert.ok(profile.fightingStyles.length >= 1, 'Must have at least one fighting style');
    assert.ok(profile.bodySilhouette, 'Must have body silhouette');
    assert.ok(profile.evolutionStage, 'Must have evolution stage');
    assert.ok(profile.flavorText, 'Must have flavor text');
    assert.ok(profile.retreatCost >= 1, 'Must have retreat cost');
    assert.ok(profile.stats.hp > 0, 'HP must be positive');
    assert.ok(profile.stats.attack > 0, 'Attack must be positive');
    assert.ok(profile.stats.defense > 0, 'Defense must be positive');
    assert.equal(profile.moves.length, 2, 'Card must have exactly 2 TCG moves');
    assert.ok(profile.moves[0].damage > 0);
    assert.ok(profile.moves[1].damage > 0);
    assert.ok(profile.collectorNumber.startsWith('№ '));
  }
});

test('multi-variable cards have dual elements, hybrid fighting styles, and multi-powers', () => {
  const cards = CARD_MANIFESTS;
  let dualElementCount = 0;
  let dualStyleCount = 0;
  let multiPowerCount = 0;

  for (const card of cards) {
    const profile = getCardVariableProfile(card);
    if (profile.hasDualElement) {
      dualElementCount++;
      assert.ok(profile.secondaryElement, 'Dual element card must have secondaryElement');
      assert.equal(profile.elements.length, 2);
    }
    if (profile.hasDualStyle) {
      dualStyleCount++;
      assert.ok(profile.secondaryFightingStyle);
      assert.equal(profile.fightingStyles.length, 2);
    }
    if (profile.specialPowers.length > 1) {
      multiPowerCount++;
    }
  }

  assert.ok(dualElementCount > 0, 'Should have cards with dual elements');
  assert.ok(dualStyleCount > 0, 'Should have cards with hybrid styles');
  assert.ok(multiPowerCount > 0, 'Should have cards with multiple powers');
});

test('calculateDeckSynergies evaluates active team combinations correctly', () => {
  // Empty deck: no active synergies
  const emptySynergies = calculateDeckSynergies([]);
  assert.ok(emptySynergies.every((s) => !s.active));

  // Deck with cards having diverse elements
  const cards = CARD_MANIFESTS.slice(0, 5).map((c) => c.id);
  const synergies = calculateDeckSynergies(cards);
  assert.ok(synergies.length >= 6);
  assert.ok(synergies.some((s) => s.id === 'elemental-harmony' || s.id === 'dual-resonance'));
});

test('generateVariableMatrix computes accurate cross-classification and counts', () => {
  const meta = createInitialMeta();
  const matrix = generateVariableMatrix(meta);

  assert.equal(matrix.totalCards, CARD_MANIFESTS.length);
  assert.equal(matrix.totalCollected, 0);

  // Check element totals sum to CARD_MANIFESTS.length
  const totalByElement = Object.values(matrix.byElement).reduce((sum, item) => sum + item.total, 0);
  assert.equal(totalByElement, CARD_MANIFESTS.length);

  // Check data type totals sum to CARD_MANIFESTS.length
  const totalByDataType = Object.values(matrix.byDataType).reduce((sum, item) => sum + item.total, 0);
  assert.equal(totalByDataType, CARD_MANIFESTS.length);

  // Check style totals sum to CARD_MANIFESTS.length
  const totalByStyle = Object.values(matrix.byFightingStyle).reduce((sum, item) => sum + item.total, 0);
  assert.equal(totalByStyle, CARD_MANIFESTS.length);

  // Check multi-variable tracking
  assert.ok(matrix.multiVariableBreakdown.dualElements.total > 0);
  assert.ok(matrix.multiVariableBreakdown.hasAnyMultiVariable.total > 0);
  assert.ok(matrix.byEvolutionStage['Apex EX'].total > 0);
  assert.ok(Object.keys(matrix.bySilhouette).length >= 5);
});

test('new apex variants are integrated with rigs, silhouettes and evolution titles', () => {
  const apexIds = [
    'apex-chimera',
    'cyber-leviathan',
    'solar-seraph',
    'chrono-valkyrie',
    'abyss-behemoth',
    'quantum-kirin',
  ];

  for (const id of apexIds) {
    const variant = LOKPET_VARIANTS.find((v) => v.id === id);
    assert.ok(variant, `Variant ${id} should exist`);
    assert.equal(variant.legendary, true);
    assert.ok(variant.specialAbility);
    const rig = lokPetRig(variant.silhouette);
    assert.ok(rig && rig.parts.length > 0, `Rig for ${variant.silhouette} should have parts`);
    const title3 = getLokPetEvolutionTitle(id, 3);
    assert.ok(title3, `Evolution title for ${id} stage 3 should exist`);
  }
});
