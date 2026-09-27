import assert from 'node:assert/strict';
import test from 'node:test';

import { CHARACTERS_BY_ID } from '@/game/data/characters';
import { LOKPET_VARIANTS_BY_ID } from '@/game/data/lokPets';

const LEGENDARY_CHARACTERS = [
  ['bellwright', 'resonance-return'],
  ['mawheel', 'grind-charge'],
  ['lantern-widow', 'ghostlight-network'],
  ['brassback', 'steam-harpoon'],
  ['paper-saint', 'origami-decoys'],
  ['eclipse-pilgrim', 'event-horizon'],
  ['bloomheart', 'root-network'],
  ['marionette-king', 'royal-command'],
  ['cryo-mantis', 'zero-split'],
  ['neon-leviathan', 'tidal-memory'],
] as const;

const LEGENDARY_PETS = [
  ['prism-moth', 'prism-moth', 'prism-collect', 0.68],
  ['void-pup', 'void-pup', 'void-fetch', 0.92],
  ['ember-koi', 'ember-koi', 'ember-rescue', 1.28],
  ['clockwork-beetle', 'clock-beetle', 'clock-pause', 0.76],
] as const;

test('the dated legendary roster is playable and keeps its design contract', () => {
  const weaponIds = new Set<string>();

  for (const [id, pattern] of LEGENDARY_CHARACTERS) {
    const character = CHARACTERS_BY_ID[id];
    assert.ok(character, `${id} must be registered in the playable roster`);
    assert.equal(character.rarity, 'legendary');
    assert.equal(character.unlock.kind, 'default');
    assert.equal(character.signatureTraits?.length, 2);
    assert.equal(character.weapon.legendaryPattern, pattern);
    assert.ok(character.palette.glow, `${id} must keep its legendary glow color`);
    assert.ok(!weaponIds.has(character.weapon.id), `${character.weapon.id} must remain unique`);
    weaponIds.add(character.weapon.id);
  }
});

test('the four legendary pets keep distinct silhouettes, sizes, and abilities', () => {
  const silhouettes = new Set<string>();
  const sizes = new Set<number>();

  for (const [id, silhouette, ability, sizeScale] of LEGENDARY_PETS) {
    const pet = LOKPET_VARIANTS_BY_ID[id];
    assert.ok(pet, `${id} must be registered in the LokPet pool`);
    assert.equal(pet.legendary, true);
    assert.equal(pet.silhouette, silhouette);
    assert.equal(pet.specialAbility, ability);
    assert.equal(pet.sizeScale, sizeScale);
    assert.ok(!silhouettes.has(pet.silhouette), `${id} must keep a distinct silhouette`);
    assert.ok(!sizes.has(pet.sizeScale!), `${id} must keep a distinct gameplay size`);
    silhouettes.add(pet.silhouette);
    sizes.add(pet.sizeScale!);
  }
});
