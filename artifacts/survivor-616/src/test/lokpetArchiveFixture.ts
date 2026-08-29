import { LOKPET_VARIANTS_BY_ID } from '@/game/data/lokPets';
import type { LokPetAttackKind, LokPetElement, LokPetRarity, RunResult } from '@/game/types';

type FixturePet = RunResult['lokPets'][number];

function fixturePet(
  variantId: string,
  name: string,
  rarity: LokPetRarity,
  attackKind: LokPetAttackKind,
  element: LokPetElement,
): FixturePet {
  const variant = LOKPET_VARIANTS_BY_ID[variantId];
  const elementLabel = element === 'none' ? 'kinetic' : element;
  const attackLabel = attackKind === 'shot'
    ? 'single shot'
    : attackKind === 'rapid-shot'
      ? 'rapid fire'
      : attackKind === 'heavy-shot'
        ? 'heavy shot'
        : attackKind === 'pulse'
          ? 'pulsating field'
          : 'burst explosion';

  return {
    name,
    variantId,
    family: variant.family,
    silhouette: variant.silhouette,
    palette: variant.palette,
    rarity,
    rarityLabel: rarity,
    attackKind,
    element,
    elementLabel,
    traitLabel: element === 'none' ? attackLabel : `${attackLabel} · ${elementLabel}`,
    health: 42,
    damage: 11,
    cooldownMs: 900,
    range: 250,
    ghosted: false,
  };
}

/**
 * Development-only result used by the browser regression test. It models
 * three distinct catalog outcomes in one run: a new variant, a known variant
 * with new catalog data, and a repeat sighting with no new data.
 */
export function createLokPetArchiveFixtureResult(): RunResult {
  return {
    areaId: 'back-alley',
    characterId: 'shade',
    cleared: false,
    survivedSec: 42,
    kills: 18,
    level: 4,
    cred: 12,
    killsByEnemy: {},
    newlyUnlockedCharacterIds: [],
    loadout: {
      weapons: [{ id: 'shade-blade', name: 'Shade Blade', level: 2 }],
      passives: [],
    },
    lootBoxesOpened: 3,
    openedPrizes: ['Moss Pouncer', 'Cinder Pouncer', 'Chalk Grin'],
    lokPets: [
      fixturePet('moss-pouncer', 'Pip · Moss Pouncer', 'common', 'shot', 'none'),
      fixturePet('cinder-pouncer', 'Glim · Cinder Pouncer', 'rare', 'rapid-shot', 'fire'),
      fixturePet('chalk-grin', 'Hush · Chalk Grin', 'common', 'pulse', 'freeze'),
    ],
    lokPetDiscoveries: [
      {
        variantId: 'moss-pouncer',
        sightings: 1,
        totalSightings: 1,
        newVariant: true,
        newRarities: ['common'],
        newTraits: [{
          attackKind: 'shot',
          element: 'none',
          elementLabel: 'kinetic',
          label: 'single shot',
        }],
      },
      {
        variantId: 'cinder-pouncer',
        sightings: 1,
        totalSightings: 4,
        newVariant: false,
        newRarities: ['rare'],
        newTraits: [{
          attackKind: 'rapid-shot',
          element: 'fire',
          elementLabel: 'fire',
          label: 'rapid fire · fire',
        }],
      },
      {
        variantId: 'chalk-grin',
        sightings: 1,
        totalSightings: 6,
        newVariant: false,
        newRarities: [],
        newTraits: [],
      },
    ],
    lootTokensGained: 0,
    skeletonKeysGained: 0,
    completedObjectives: [],
    crewRumor: {
      rumorId: 'bell-shock',
      rumorName: 'Bell Shock',
      icon: 'bell',
      allyId: 'vee',
      effectLabel: 'First contact triggers a defensive knockback pulse.',
      triggered: true,
      outcome: 'Bell Shock shoved nearby threats away on first contact.',
    },
  };
}