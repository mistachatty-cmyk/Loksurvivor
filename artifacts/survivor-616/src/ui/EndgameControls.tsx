/**
 * Endgame switches shared by Settings (Victory Lap page) and the hideout Endgame dock,
 * so the two places always agree. Everything reads and writes the Forge store.
 */
import { useState } from 'react';

import { ENDGAME_FEATURES, type EndgameFeatureId } from '@/game/data/endgameUnlocks';
import {
  getRunUse, isFeatureAvailable, isFeatureEnabled, setAllCustomsActive, setCustomMaster, setFeatureEnabled,
} from '@/game/state/operatorForgeStore';
import { t } from '@/lib/i18n';

const BUTTON =
  'min-h-9 border border-border bg-background px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white transition-colors hover:border-primary';

export function Switch({ on, label, onClick, disabled, testId }: { on: boolean; label: string; onClick: () => void; disabled?: boolean; testId?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`h-6 w-11 shrink-0 border transition-colors disabled:opacity-50 ${on ? 'border-primary bg-primary' : 'border-border bg-background'}`}
      data-testid={testId}
    >
      <span className={`block h-4 w-4 bg-white transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

/** The master "use my customs in runs" switch with All on / All off. */
export function CustomsRunSwitch({ onChange }: { onChange?: () => void }) {
  const [, bump] = useState(0);
  const master = getRunUse().master;
  const change = (fn: () => void) => { fn(); bump((n) => n + 1); onChange?.(); };
  return (
    <div className="flex flex-wrap items-center gap-3 border border-border/70 bg-background/50 p-3" data-testid="customs-run-switch">
      <Switch on={master} label={t('endgame.runs.master')} onClick={() => change(() => setCustomMaster(!master))} testId="switch-customs-master" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black uppercase text-white">{t('endgame.runs.master')}</p>
        <p className="text-xs text-muted-foreground">{t('endgame.runs.masterBody')}</p>
      </div>
      <div className="flex gap-2">
        <button type="button" className={BUTTON} onClick={() => change(() => setAllCustomsActive(true))} data-testid="button-customs-all-on">{t('endgame.runs.allOn')}</button>
        <button type="button" className={BUTTON} onClick={() => change(() => setAllCustomsActive(false))} data-testid="button-customs-all-off">{t('endgame.runs.allOff')}</button>
      </div>
    </div>
  );
}

/** Compact feature switches for the dock. Returns true through onReload when a feature needs a page reload. */
export function CompactFeatureSwitches({ devAll, onReload }: { devAll: boolean; onReload: () => void }) {
  const [, bump] = useState(0);
  const features = ENDGAME_FEATURES.filter((f) => isFeatureAvailable(f.id) || (f.id === 'forge' && devAll));
  const toggle = (id: EndgameFeatureId, needsReload: boolean) => {
    setFeatureEnabled(id, !isFeatureEnabled(id));
    if (needsReload) onReload();
    bump((n) => n + 1);
  };
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {features.map((f) => {
        const on = (f.id === 'forge' && devAll) || isFeatureEnabled(f.id);
        return (
          <li key={f.id} className="flex items-center gap-2 border border-border/70 bg-background/50 p-2">
            <Switch on={on} label={f.label} disabled={f.id === 'forge' && devAll} onClick={() => toggle(f.id, f.needsReload)} testId={`dock-switch-${f.id}`} />
            <span className="min-w-0 truncate text-xs font-bold uppercase text-white">{f.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
