/**
 * Settings section for the end-game extras: switches for each earned feature,
 * and the five custom operator slots with how each is earned. Before the end
 * game is reached it is a single quiet line, so nothing extra sits on screen.
 */
import { useState } from 'react';

import { CUSTOM_SLOTS, ENDGAME_FEATURES, endgameReached, isSlotEarned, type EndgameFeatureId } from '@/game/data/endgameUnlocks';
import { isFeatureAvailable, isFeatureEnabled, setFeatureEnabled } from '@/game/state/operatorForgeStore';
import { useMeta } from '@/game/state/metaStore';
import { OperatorForgePanel } from './OperatorForgePanel';

export function EndgameSettings() {
  const { meta } = useMeta();
  const [, bump] = useState(0);
  const [forgeOpen, setForgeOpen] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);

  const available = ENDGAME_FEATURES.filter((f) => isFeatureAvailable(f.id) || (f.id === 'forge' && meta.devModeAllUnlocks));
  const [burst, setBurst] = useState<{ id: string; n: number } | null>(null);

  const toggle = (id: EndgameFeatureId, needsPageReload: boolean) => {
    const turningOn = !isFeatureEnabled(id);
    setFeatureEnabled(id, turningOn);
    if (turningOn) setBurst({ id, n: Date.now() });
    if (needsPageReload) setNeedsReload(true);
    bump((n) => n + 1);
  };

  const forgeOn = meta.devModeAllUnlocks || isFeatureEnabled('forge');

  return (
    <section className="endgame-panel mx-auto max-w-5xl p-5 sm:p-6" data-testid="endgame-section">
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-200">End game</p>
      <h2 className="endgame-title mt-1 text-3xl font-black uppercase">Victory Lap</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {meta.devModeAllUnlocks
          ? 'Dev Mode opens the Operator Forge and all five design slots. Your created operators stay saved when Dev Mode is off.'
          : 'Earned by clearing every standard map. Each one is off until you turn it on, and none of them change the operators you already have.'}
      </p>

      <ul className="mt-4 space-y-2">
        {available.map((feature) => {
          const on = (feature.id === 'forge' && meta.devModeAllUnlocks) || isFeatureEnabled(feature.id);
          return (
            <li key={feature.id} className={`relative flex items-start gap-3 border p-3 transition-shadow ${on ? 'endgame-card-on border-fuchsia-300/60 bg-fuchsia-400/10' : 'border-border/70 bg-background/50'}`}>
              {burst?.id === feature.id ? <Sparks key={burst.n} /> : null}
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={feature.label}
                disabled={feature.id === 'forge' && meta.devModeAllUnlocks}
                onClick={() => toggle(feature.id, feature.needsReload)}
                className={`mt-0.5 h-6 w-11 shrink-0 border transition-colors ${on ? 'border-primary bg-primary' : 'border-border bg-background'}`}
                data-testid={`switch-endgame-${feature.id}`}
              >
                <span className={`block h-4 w-4 bg-white transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black uppercase text-white">{feature.label}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{feature.id === 'forge' && meta.devModeAllUnlocks ? 'On while Dev Mode is active. Open the Forge below to create up to five operators.' : feature.blurb}</p>
              </div>
            </li>
          );
        })}
      </ul>

      {needsReload ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 border border-primary/50 bg-primary/10 px-4 py-3 text-sm" role="status">
          <span className="min-w-0 flex-1">Reload to add or hide custom operators on the roster.</span>
          <button type="button" onClick={() => window.location.reload()} className="border border-primary bg-primary px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-primary-foreground" data-testid="button-endgame-reload">
            Reload now
          </button>
        </div>
      ) : null}

      {forgeOn ? (
        <button
          type="button"
          onClick={() => setForgeOpen(true)}
          className="mt-4 border border-fuchsia-300/60 bg-fuchsia-400/15 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-fuchsia-100 hover:bg-fuchsia-400/25"
          data-testid="button-open-forge"
        >
          Open the Forge
        </button>
      ) : null}

      <h3 className="mt-6 text-sm font-black uppercase tracking-wide text-white">Custom operator slots</h3>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2" data-testid="list-endgame-slots">
        {CUSTOM_SLOTS.map((slot) => {
          const earned = meta.devModeAllUnlocks || isSlotEarned(slot, meta);
          const goal = slot.goal?.(meta);
          return (
            <li key={slot.id} className={`border p-3 ${earned ? 'endgame-slot-earned border-amber-300/60 bg-amber-300/5' : 'border-border/70 bg-background/50 opacity-80'}`} data-testid={`slot-endgame-${slot.id}`}>
              <p className="text-sm font-black uppercase text-white">{slot.label} <span className="font-mono text-[10px] tracking-widest text-muted-foreground">{earned ? 'earned' : 'locked'}</span></p>
              <p className="text-xs text-muted-foreground">
                {slot.how}
                {!earned && goal && reachedLine(meta, goal)}
              </p>
            </li>
          );
        })}
      </ul>

      {forgeOpen ? <OperatorForgePanel onClose={() => setForgeOpen(false)} /> : null}
    </section>
  );
}

function reachedLine(meta: Parameters<typeof endgameReached>[0], goal: { have: number; need: number }) {
  if (!endgameReached(meta)) return ' Clear every map first.';
  return ` (${Math.min(goal.have, goal.need).toLocaleString()}/${goal.need.toLocaleString()})`;
}

const SPARK_COLORS = ['#f0abfc', '#67e8f9', '#fde047', '#86efac', '#ffffff'];

/** A short burst of confetti squares when a feature is switched on. Purely visual. */
function Sparks() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      {Array.from({ length: 14 }, (_, i) => {
        const angle = (i / 14) * Math.PI * 2;
        const dist = 36 + (i % 4) * 14;
        return (
          <span
            key={i}
            className="endgame-spark"
            style={{
              ['--sx' as string]: `${8 + (i % 5) * 4}%`,
              ['--sc' as string]: SPARK_COLORS[i % SPARK_COLORS.length],
              ['--dx' as string]: `${Math.cos(angle) * dist}px`,
              ['--dy' as string]: `${Math.sin(angle) * dist}px`,
            }}
          />
        );
      })}
    </span>
  );
}
