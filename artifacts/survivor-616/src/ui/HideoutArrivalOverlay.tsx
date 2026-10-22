/**
 * A brief "arriving at the hideout" beat shown once per session before the
 * hideout menu: the character stands outside in the loud rain, then a tap
 * dampens it down and reveals the menu underneath. Reuses the exact
 * `hideout-weather-*` CSS layer HubScreen itself renders for a room's
 * weather, so the outside scene matches whatever the hideout looks like once
 * you're actually inside it.
 *
 * Owns its own ambience bed at a louder-than-normal level and ramps it down
 * to the hideout's usual level on "Step inside" -- HubScreen's own ambience
 * effect stays off for as long as this overlay is mounted (see its
 * `showArrival` guard) so the two never run at once.
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

import { startHideoutAmbience, type AmbienceHandle } from '@/game/audio/ambience';
import { weatherClass } from '@/game/data/hideout';
import type { CharacterDef, HideoutSceneDef, SpritePalette } from '@/game/types';
import { readArrivalDiscsEnabled } from '@/lib/arrivalDiscs';
import { armDiscGuard, resetDiscGuard } from '@/lib/discGuard';
import { useT } from '@/lib/i18n';
import { ErrorBoundary } from '@/components/error-boundary';
import { RigPortrait } from './RigPortrait';

// Opt-in floating CDs (Settings, or `?arrivalDiscs`). Lazy so the carousel is
// never part of the first-load bundle for anyone who has it off.
const ArrivalDiscShelf = lazy(() => import('./ArrivalDiscShelf'));

export interface HideoutArrivalOverlayProps {
  character: CharacterDef;
  palette: SpritePalette;
  scene: HideoutSceneDef;
  ambienceEnabled: boolean;
  ensureAudioContext: () => AudioContext | null;
  onEnter: () => void;
}

const LOUD_LEVEL = 0.85;
const INDOOR_LEVEL = 0.35;
const DAMPEN_MS = 900;

export function HideoutArrivalOverlay({
  character,
  palette,
  scene,
  ambienceEnabled,
  ensureAudioContext,
  onEnter,
}: HideoutArrivalOverlayProps) {
  const ambienceRef = useRef<AmbienceHandle | null>(null);
  const [entering, setEntering] = useState(false);
  // The guard also decides lite mode: a phone, or a visit that last ended badly.
  const [discSafety] = useState(() => (readArrivalDiscsEnabled() ? armDiscGuard() : { lite: true, off: false }));
  const t = useT();
  // After two bad visits the discs stay off, but the player can try them again (in the lightest mode) from here.
  const [retryDiscs, setRetryDiscs] = useState(false);
  const wantsDiscs = readArrivalDiscsEnabled();
  const discsEnabled = wantsDiscs && (!discSafety.off || retryDiscs);
  const discsPaused = wantsDiscs && discSafety.off && !retryDiscs;

  useEffect(() => {
    if (!ambienceEnabled) return;
    const handle = startHideoutAmbience(ensureAudioContext(), scene, LOUD_LEVEL);
    ambienceRef.current = handle;
    return () => {
      handle?.stop();
      ambienceRef.current = null;
    };
    // Intentionally mount-once: this scene shows exactly once and shouldn't
    // restart its ambience bed if any of these happen to change mid-scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEnter = () => {
    if (entering) return;
    setEntering(true);
    const handle = ambienceRef.current;
    if (handle) {
      const start = performance.now();
      const step = (time: number) => {
        const t = Math.min(1, (time - start) / DAMPEN_MS);
        handle.setLevel(LOUD_LEVEL + (INDOOR_LEVEL - LOUD_LEVEL) * t);
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    window.setTimeout(() => {
      ambienceRef.current?.stop();
      ambienceRef.current = null;
      onEnter();
    }, DAMPEN_MS + 250);
  };

  return (
    <div
      className="relative flex min-h-[100dvh] flex-col items-center justify-end overflow-hidden bg-black p-6 text-center text-white sm:p-10"
      data-testid="screen-hideout-arrival"
    >
      <div
        className={`hideout-ambient absolute inset-0 ${weatherClass(scene.weather)}`}
        style={{ '--scene-accent': scene.homeAccent, '--scene-sky': scene.skyAccent } as React.CSSProperties}
        aria-hidden="true"
      >
        <div className="hideout-sky-glow" />
        <div className="hideout-weather-particles" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/80" aria-hidden="true" />

      {discsEnabled ? (
        <div
          className={`absolute inset-x-0 top-[5dvh] z-[5] h-[54dvh] transition-opacity duration-500 ${
            entering ? 'opacity-0' : 'opacity-100'
          }`}
          data-testid="arrival-disc-shelf"
        >
          {/* A failed disc chunk must never take the arrival screen down with it. */}
          <ErrorBoundary FallbackComponent={() => null}>
            <Suspense fallback={null}>
              <ArrivalDiscShelf
                lite={discSafety.lite || retryDiscs}
                onPlay={() => {
                  // A disc replaces the rain bed: one audio source at a time keeps phones steady.
                  ambienceRef.current?.stop();
                  ambienceRef.current = null;
                }}
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      ) : null}

      {discsPaused ? (
        <button
          type="button"
          onClick={() => {
            resetDiscGuard();
            setRetryDiscs(true);
          }}
          className="absolute inset-x-6 top-[8dvh] z-10 mx-auto max-w-xs border border-sky-300/50 bg-[#0a2540]/80 px-4 py-3 text-left text-sm text-sky-100"
          data-testid="button-arrival-discs-retry"
        >
          <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300">{t('arrival.discsPaused.title')}</span>
          <span className="mt-1 block leading-snug">{t('arrival.discsPaused.body')}</span>
        </button>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: entering ? 0 : 1, y: entering ? -8 : 0 }}
        transition={{ duration: entering ? 0.5 : 0.8 }}
        className="relative z-10 mb-10 flex flex-col items-center gap-5"
      >
        <div className="grid h-36 w-36 place-items-center">
          <RigPortrait rig={character.rig} palette={palette} anim="idle" size={128} />
        </div>
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">
            Outside the hideout
          </p>
          <p className="mt-2 max-w-xs text-sm text-white/70">{scene.weatherDescription}</p>
        </div>
        <button
          type="button"
          onClick={handleEnter}
          disabled={entering}
          className="bg-primary px-8 py-4 font-display text-sm font-black uppercase tracking-[.14em] text-primary-foreground transition-opacity disabled:opacity-60"
          data-testid="button-hideout-arrival-enter"
        >
          Step inside
        </button>
      </motion.div>
    </div>
  );
}

export default HideoutArrivalOverlay;
