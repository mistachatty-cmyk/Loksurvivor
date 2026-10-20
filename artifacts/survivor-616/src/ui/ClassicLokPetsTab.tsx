import { useMemo } from 'react';

import { LOKPET_VARIANTS, lokPetRig, lokPetSpritePalette } from '@/game/data/lokPets';
import { t } from '@/lib/i18n';
import { VariantStudio, type VariantEntry } from './VariantStudio';

/** Forge "LokPets" screen: the classic LokPet roster, recolorable. */
export function ClassicLokPetsTab() {
  const entries = useMemo<VariantEntry[]>(
    () => LOKPET_VARIANTS.map((p) => ({
      id: p.id,
      name: p.name,
      group: p.family,
      blurb: p.description,
      facts: `${p.family} · ${p.silhouette}${p.legendary ? ' · legendary' : ''}`,
      rig: lokPetRig(p.silhouette),
      palette: lokPetSpritePalette(p.palette),
    })),
    [],
  );
  return <VariantStudio kind="pet" entries={entries} intro={t('forge.variants.petsIntro')} testId="forge-lokpets" />;
}
