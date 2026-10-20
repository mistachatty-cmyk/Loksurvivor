import { useMemo } from 'react';

import { ENEMIES } from '@/game/data/enemies';
import { t } from '@/lib/i18n';
import { VariantStudio, type VariantEntry } from './VariantStudio';

/** Forge "Enemies" screen: the classic enemy roster, recolorable. */
export function ClassicEnemiesTab() {
  const entries = useMemo<VariantEntry[]>(
    () => ENEMIES.map((e) => ({
      id: e.id,
      name: e.name,
      group: e.faction ?? e.family,
      blurb: e.lore,
      facts: `${e.family} · ${e.behavior} · ${e.hp} hp · speed ${e.speed}`,
      rig: e.rig,
      palette: e.palette,
    })),
    [],
  );
  return <VariantStudio kind="enemy" entries={entries} intro={t('forge.variants.enemiesIntro')} testId="forge-enemies" />;
}
