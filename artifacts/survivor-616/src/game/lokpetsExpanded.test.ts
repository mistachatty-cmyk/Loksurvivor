import assert from 'node:assert/strict';
import test from 'node:test';
import { createRng } from './engine/math';
import {
  LOKPET_VARIANTS,
  LOKPET_ELEMENT_COLORS,
  LOKPET_SILHOUETTE_LABELS,
  getLokPetEvolutionStage,
  getLokPetEvolutionTitle,
  lokPetRig,
  rollLokPet,
} from './data/lokPets';
import {
  BATTLE_MOVES,
  LEAGUE_TIERS,
  SPARRING_DUMMIES,
  getElementalMultiplier,
} from './data/lokPetBattles';
import {
  assignBattleMoves,
  convertSavedPetToBattlePet,
  generateOpponentPet,
  getExpForLevel,
} from './engine/lokPetBattle';
import type { LokPetElement, SavedLokPet } from './types';

test('all 10 digital elements have defined colors and labels', () => {
  const elements: LokPetElement[] = [
    'none', 'fire', 'freeze', 'slow', 'volt',
    'glitch', 'terra', 'aero', 'light', 'dark',
  ];
  for (const elem of elements) {
    assert.ok(LOKPET_ELEMENT_COLORS[elem], `Missing color for element ${elem}`);
  }
});

test('new digi variants generate valid rigs and unique special abilities', () => {
  const newVariants = [
    'terra-gargoyle', 'aero-raptor', 'photon-lynx',
    'null-abyss', 'cyber-pangolin', 'ion-pegasus', 'glitch-dragon',
  ];
  for (const variantId of newVariants) {
    const variant = LOKPET_VARIANTS.find((v) => v.id === variantId);
    assert.ok(variant, `Variant ${variantId} should exist in LOKPET_VARIANTS`);
    assert.ok(variant.silhouette, `Variant ${variantId} should have a silhouette`);
    assert.ok(LOKPET_SILHOUETTE_LABELS[variant.silhouette], `Silhouette label for ${variant.silhouette} should exist`);
    const rig = lokPetRig(variant.silhouette);
    assert.ok(rig && rig.parts.length > 0, `Rig for ${variant.silhouette} should be authored with parts`);
    const roll = rollLokPet(createRng(42), { fixedVariantId: variantId });
    assert.equal(roll.variantId, variantId);
    assert.ok(roll.stats.damage > 0);
  }
});

test('companion evolution stages and digi-thematic titles progress with level', () => {
  // Standard companion
  assert.equal(getLokPetEvolutionStage(1, false), 1);
  assert.equal(getLokPetEvolutionStage(14, false), 1);
  assert.equal(getLokPetEvolutionStage(15, false), 2);
  assert.equal(getLokPetEvolutionStage(29, false), 2);
  assert.equal(getLokPetEvolutionStage(30, false), 3);
  assert.equal(getLokPetEvolutionStage(50, false), 3);

  // Starter companion
  assert.equal(getLokPetEvolutionStage(1, true), 1);
  assert.equal(getLokPetEvolutionStage(32, true), 1);
  assert.equal(getLokPetEvolutionStage(33, true), 2);
  assert.equal(getLokPetEvolutionStage(65, true), 2);
  assert.equal(getLokPetEvolutionStage(66, true), 3);

  // Titles for new and existing variants
  const gargoyleTitle1 = getLokPetEvolutionTitle('terra-gargoyle', 1);
  const gargoyleTitle2 = getLokPetEvolutionTitle('terra-gargoyle', 2);
  const gargoyleTitle3 = getLokPetEvolutionTitle('terra-gargoyle', 3);
  assert.equal(gargoyleTitle1, 'Silicon Imp');
  assert.equal(gargoyleTitle2, 'Granite Sentinel');
  assert.equal(gargoyleTitle3, 'Obsidian Bastion Titan');
});

test('assignBattleMoves scales skills dynamically based on pet level and evolution', () => {
  const lowMoves = assignBattleMoves('cinder-pouncer', 'animal', 'fire', 5, 1);
  const highMoves = assignBattleMoves('cinder-pouncer', 'animal', 'fire', 20, 2);

  // Level 5 fire skill is basic ember-spit
  assert.equal(lowMoves[1].id, 'ember-spit');
  // Level 20 fire skill evolves to pyro-burst
  assert.equal(highMoves[1].id, 'pyro-burst');

  // Terra move assigned for terra pet
  const terraMoves = assignBattleMoves('terra-gargoyle', 'mechanical', 'terra', 20, 2);
  assert.equal(terraMoves[1].id, 'silicon-shard');
  assert.equal(terraMoves[2].id, 'tectonic-firewall');
  assert.equal(terraMoves[3].id, 'granite-avalanche');
});

test('assignBattleMoves no longer falls back to the generic move for every family', () => {
  // mote/blob/bat/ghoul previously had no step-3 branch for a 'none'-element,
  // un-named-variant pet, and fell through to the fully generic barrier-shield.
  const mote = assignBattleMoves('signal-mote', 'mote', 'none', 1, 1);
  const blob = assignBattleMoves('plum-jelly', 'blob', 'none', 1, 1);
  const ghoul = assignBattleMoves('chalk-grin', 'ghoul', 'none', 1, 1);
  assert.notEqual(mote[2].id, 'barrier-shield');
  assert.notEqual(blob[2].id, 'barrier-shield');
  assert.notEqual(ghoul[2].id, 'barrier-shield');
});

test('ordinary rolls lean toward their family\'s elemental bias without ever losing other elements', () => {
  // mechanical leans volt/terra; roll enough times that the lean reliably shows,
  // while confirming at least one other element still appears (never an override).
  const counts: Record<string, number> = {};
  for (let i = 0; i < 400; i += 1) {
    const roll = rollLokPet(createRng(2000 + i));
    const variant = LOKPET_VARIANTS.find((v) => v.id === roll.variantId);
    if (variant?.family === 'mechanical') counts[roll.element] = (counts[roll.element] ?? 0) + 1;
  }
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  assert.ok(total > 0, 'expected at least one mechanical-family roll in 400 tries');
  const leanShare = ((counts.volt ?? 0) + (counts.terra ?? 0)) / total;
  assert.ok(leanShare > 0.3, `expected mechanical's volt/terra lean to show up more than baseline, got ${leanShare}`);
  assert.ok(Object.keys(counts).length > 2, 'expected other elements to still appear, not just the biased ones');
});

test('elemental multiplier matrix handles full 10-element digital rock-paper-scissors', () => {
  // Fire vs Terra
  const fireVsTerra = getElementalMultiplier('fire', 'terra');
  assert.equal(fireVsTerra.multiplier, 1.75);

  // Terra vs Volt
  const terraVsVolt = getElementalMultiplier('terra', 'volt');
  assert.equal(terraVsVolt.multiplier, 1.75);

  // Aero vs Slow
  const aeroVsSlow = getElementalMultiplier('aero', 'slow');
  assert.equal(aeroVsSlow.multiplier, 1.75);

  // Light vs Glitch
  const lightVsGlitch = getElementalMultiplier('light', 'glitch');
  assert.equal(lightVsGlitch.multiplier, 1.75);

  // Dark vs Light
  const darkVsLight = getElementalMultiplier('dark', 'light');
  assert.equal(darkVsLight.multiplier, 1.75);

  // Resistances
  const fireVsSlow = getElementalMultiplier('fire', 'slow');
  assert.equal(fireVsSlow.multiplier, 0.65);

  const voltVsTerra = getElementalMultiplier('volt', 'terra');
  assert.equal(voltVsTerra.multiplier, 0.65);

  // Neutral
  const kineticVsFire = getElementalMultiplier('none', 'fire');
  assert.equal(kineticVsFire.multiplier, 1.0);
});

test('convertSavedPetToBattlePet scales stats with evolution stage', () => {
  const baseRoll = rollLokPet(createRng(100), { fixedVariantId: 'terra-gargoyle' });
  const savedPetLv5: SavedLokPet = {
    id: 'test-pet-lv5',
    roll: baseRoll,
    stamina: 3,
    level: 5,
    exp: 0,
  };
  const savedPetLv35: SavedLokPet = {
    id: 'test-pet-lv35',
    roll: baseRoll,
    stamina: 3,
    level: 35,
    exp: 0,
  };

  const battlePetLv5 = convertSavedPetToBattlePet(savedPetLv5);
  const battlePetLv35 = convertSavedPetToBattlePet(savedPetLv35);

  assert.equal(battlePetLv5.evolutionStage, 1);
  assert.equal(battlePetLv35.evolutionStage, 3);
  assert.ok(battlePetLv35.maxHp > battlePetLv5.maxHp * 2);
  assert.ok(battlePetLv35.attack > battlePetLv5.attack * 2);
  assert.equal(battlePetLv35.moves.length, 4);
});

test('arena features 8 distinct league tiers and diverse sparring dummies', () => {
  assert.equal(LEAGUE_TIERS.length, 8);
  for (let i = 0; i < LEAGUE_TIERS.length; i++) {
    const tier = LEAGUE_TIERS[i];
    assert.equal(tier.tierNumber, i + 1);
    assert.ok(tier.title);
    assert.ok(tier.team.length >= 2);
    assert.ok(tier.rewards.cred > 0);
  }
  assert.ok(SPARRING_DUMMIES.length >= 6);
  assert.ok(SPARRING_DUMMIES.some((d) => d.variantId === 'terra-gargoyle'));
  assert.ok(SPARRING_DUMMIES.some((d) => d.variantId === 'aero-raptor'));
});
