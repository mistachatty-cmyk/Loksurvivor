/**
 * Hideout Endgame dock: the end-game switches and shortcuts in one collapsible strip.
 * Shown only once Victory Lap is reached, and can be hidden in Endgame settings.
 * It reads the same store as the Settings page, so both always agree.
 */
import { useState } from 'react';
import { Sparkles } from 'lucide-react';

import { endgameReached } from '@/game/data/endgameUnlocks';
import { isFeatureEnabled, isHideoutDockEnabled } from '@/game/state/operatorForgeStore';
import { useMeta } from '@/game/state/metaStore';
import type { HubPanel } from '@/game/types';
import { t } from '@/lib/i18n';
import { CompactFeatureSwitches, CustomsRunSwitch } from './EndgameControls';
import { OperatorForgePanel } from './OperatorForgePanel';

const CHIP =
  'min-h-9 border border-fuchsia-300/50 bg-fuchsia-400/10 px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-fuchsia-100 hover:bg-fuchsia-400/25';

export function HideoutEndgameDock({ onOpen }: { onOpen: (panel: HubPanel) => void }) {
  const { meta } = useMeta();
  const [open, setOpen] = useState(false);
  const [forgeOpen, setForgeOpen] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);

  if (!(meta.devModeAllUnlocks || endgameReached(meta)) || !isHideoutDockEnabled()) return null;
  const forgeOn = meta.devModeAllUnlocks || isFeatureEnabled('forge');

  return (
    <div className="mb-4 border border-fuchsia-300/40 bg-black/70 p-2 shadow-xl backdrop-blur" data-testid="hub-endgame-dock">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={`${CHIP} inline-flex items-center gap-2`} data-testid="button-hub-endgame-dock">
          <Sparkles className="h-4 w-4" />{t('endgame.dock.open')}
        </button>
        {open ? (
          <>
            {forgeOn ? <button type="button" className={CHIP} onClick={() => setForgeOpen(true)} data-testid="button-dock-forge">{t('endgame.dock.forge')}</button> : null}
            <button type="button" className={CHIP} onClick={() => onOpen('bestiary')} data-testid="button-dock-bestiary">{t('endgame.dock.bestiary')}</button>
            <button type="button" className={CHIP} onClick={() => onOpen('grpd-armory')} data-testid="button-dock-armory">{t('endgame.dock.armory')}</button>
            <button type="button" className={CHIP} onClick={() => onOpen('settings')} data-testid="button-dock-settings">{t('endgame.dock.settings')}</button>
          </>
        ) : null}
      </div>
      {open ? (
        <div className="mt-2 space-y-2">
          <CompactFeatureSwitches devAll={meta.devModeAllUnlocks} onReload={() => setNeedsReload(true)} />
          <CustomsRunSwitch />
          {needsReload ? (
            <div className="flex flex-wrap items-center gap-3 border border-primary/50 bg-primary/10 px-3 py-2 text-xs" role="status">
              <span className="min-w-0 flex-1">{t('endgame.runs.reload')}</span>
              <button type="button" onClick={() => window.location.reload()} className="border border-primary bg-primary px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-primary-foreground">Reload now</button>
            </div>
          ) : null}
        </div>
      ) : null}
      {forgeOpen ? <OperatorForgePanel onClose={() => setForgeOpen(false)} /> : null}
    </div>
  );
}
