/**
 * Bestiary view for the player's custom enemy and LokPet looks. Shown only after the end game.
 * A look is cosmetic: stats and behavior come from the base entry, and kills count toward the base.
 */
import { useState } from 'react';

import { ENEMIES_BY_ID } from '@/game/data/enemies';
import { LOKPET_VARIANTS_BY_ID, lokPetRig } from '@/game/data/lokPets';
import { isCustomActive, loadCustomVariants, setCustomActive } from '@/game/state/operatorForgeStore';
import { t } from '@/lib/i18n';
import { Switch } from './EndgameControls';
import { OperatorForgePanel } from './OperatorForgePanel';
import type { CustomVariant } from '@/game/state/operatorForgeStore';
import { RigPortrait } from './RigPortrait';

export function CustomBestiaryView({ kills }: { kills: Record<string, number> }) {
  const [, bump] = useState(0);
  const [forgeOpen, setForgeOpen] = useState(false);
  const enemies = loadCustomVariants('enemy');
  const pets = loadCustomVariants('pet');

  const card = (v: CustomVariant, kind: 'enemy' | 'pet') => {
    const group = kind === 'enemy' ? 'enemies' : 'pets';
    const enemy = kind === 'enemy' ? ENEMIES_BY_ID[v.baseId] : undefined;
    const pet = kind === 'pet' ? LOKPET_VARIANTS_BY_ID[v.baseId] : undefined;
    const rig = enemy?.rig ?? (pet ? lokPetRig(pet.silhouette) : undefined);
    if (!rig) return null;
    const baseName = enemy?.name ?? pet?.name ?? v.baseId;
    return (
      <li key={v.id} className="flex gap-3 border border-border bg-card p-3" data-testid={`custom-bestiary-${v.id}`}>
        <RigPortrait rig={rig} palette={v.palette} size={88} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black uppercase text-white">{v.name}</p>
          <p className="truncate text-xs text-muted-foreground">{baseName}{enemy ? ` · ${enemy.family} · ${enemy.hp} hp` : ''}</p>
          <p className="mt-1 text-[11px] italic text-muted-foreground">{enemy?.lore ?? pet?.description}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {t('bestiary.custom.unchanged')}{enemy ? ` · ${(kills[v.baseId] ?? 0).toLocaleString()} defeated` : ''}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Switch on={isCustomActive(group, v.id)} label={t('bestiary.custom.active')} onClick={() => { setCustomActive(group, v.id, !isCustomActive(group, v.id)); bump((n) => n + 1); }} testId={`switch-bestiary-${v.id}`} />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{t('bestiary.custom.active')}</span>
          </div>
        </div>
      </li>
    );
  };

  return (
    <div data-testid="custom-bestiary-view">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-black uppercase tracking-wide text-white">{t('bestiary.custom.tab')}</h2>
        <button type="button" onClick={() => setForgeOpen(true)} className="min-h-10 border border-border px-3 font-mono text-[11px] font-bold uppercase tracking-widest text-white hover:border-primary" data-testid="button-custom-bestiary-forge">{t('bestiary.custom.openForge')}</button>
      </div>
      {enemies.length + pets.length === 0 ? <p className="text-sm text-muted-foreground">{t('bestiary.custom.empty')}</p> : null}
      {enemies.length > 0 ? (<><h3 className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">{t('bestiary.custom.enemies')}</h3><ul className="mb-6 grid gap-3 md:grid-cols-2">{enemies.map((v) => card(v, 'enemy'))}</ul></>) : null}
      {pets.length > 0 ? (<><h3 className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">{t('bestiary.custom.pets')}</h3><ul className="grid gap-3 md:grid-cols-2">{pets.map((v) => card(v, 'pet'))}</ul></>) : null}
      {forgeOpen ? <OperatorForgePanel onClose={() => { setForgeOpen(false); bump((n) => n + 1); }} /> : null}
    </div>
  );
}
