/**
 * Lok's occasional nudge when the city goes dark: a light (or a better light) would help. It watches the
 * run's own day/night clock, never interrupts the fight (a small card at the edge, closes itself) and is
 * rationed: the first nudge after a stretch of real darkness, then a few more well apart.
 */
import { useEffect, useRef, useState, type MutableRefObject } from 'react';

import { timeOfDayDarkness } from '@/game/render/draw';
import type { World } from '@/game/engine/world';
import { useT } from '@/lib/i18n';

const DARK_AT = 0.22;
const FIRST_AFTER_MS = 12_000;
const REPEAT_MS = 110_000;
const MAX_PER_RUN = 3;
const SHOW_MS = 9000;

export function LokLightHint({ worldRef }: { worldRef: MutableRefObject<World | null> }) {
  const t = useT();
  const [message, setMessage] = useState<'optics' | 'weapons' | null>(null);
  const stateRef = useRef({ darkSince: 0, lastShownAt: -Infinity, shown: 0 });

  useEffect(() => {
    const state = stateRef.current;
    const timer = window.setInterval(() => {
      const world = worldRef.current;
      if (!world || document.hidden || world.outcome !== 'running') return;
      if (timeOfDayDarkness(world.cycle.phase) < DARK_AT) {
        state.darkSince = 0;
        return;
      }
      if (state.darkSince === 0) state.darkSince = world.now;
      if (state.shown >= MAX_PER_RUN) return;
      if (world.now - state.darkSince < FIRST_AFTER_MS) return;
      if (world.now - state.lastShownAt < REPEAT_MS) return;
      state.lastShownAt = world.now;
      state.shown += 1;
      // Without the optics the best advice is to buy them; with them, a weapon that lights the dark.
      setMessage(world.nightVisionEnabled ? 'weapons' : 'optics');
    }, 1000);
    return () => window.clearInterval(timer);
  }, [worldRef]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(null), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+7.5rem)] z-[55] flex justify-center px-3" data-testid="lok-light-hint">
      <div role="status" className="pointer-events-auto w-full max-w-sm border border-sky-300/60 bg-[#0a2540]/95 px-4 py-3 text-sky-100 shadow-[0_0_24px_rgba(56,189,248,.25)]">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300">{t('lok.light.title')}</p>
        <p className="mt-1.5 text-sm leading-snug">{t(message === 'optics' ? 'lok.light.optics' : 'lok.light.weapons')}</p>
        <button type="button" onClick={() => setMessage(null)} className="mt-2 min-h-8 font-mono text-[10px] font-bold uppercase tracking-widest text-sky-300 hover:text-white" data-testid="button-lok-light-close">
          {t('lok.light.close')}
        </button>
      </div>
    </div>
  );
}

export default LokLightHint;
