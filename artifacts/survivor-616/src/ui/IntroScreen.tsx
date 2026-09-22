/**
 * Cold open. Sets the premise before the player ever sees the hideout.
 * Owned by the design pass -- keep the export name and props stable.
 */
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Palette } from 'lucide-react';

import { useAuth } from '@/state/authStore';
import { useMeta } from '@/game/state/metaStore';
import { useMusicPlayer } from '@/game/audio/musicPlayer';
import { pickSplashText } from '@/game/data/splashText';
import { IntroTitle } from '@/ui/IntroTitle';
import { IntroPhysicsBody, IntroPhysicsProvider, IntroPhysicsReset, useIntroPhysicsResetVisible } from '@/ui/introPhysics';
import { introPhysicsForTheme, resolveIntroEvent } from '@/ui/introPresentation';

// Pulls in the full simulation engine (createWorld/stepWorld/renderWorld),
// which is otherwise only paid for once a real run starts. Lazy-loading it
// here keeps the intro's first paint just as fast as before -- the engine
// bundle loads in the background and the canvas fades in once it's ready,
// same pattern this codebase already uses for RunScreen/StudioScreen.
const AttractMode = lazy(() => import('@/ui/AttractMode').then((m) => ({ default: m.AttractMode })));

// The location tag mostly reads "Grand Rapids", but every so often fades to
// a lore-flavored alternate -- 616 as "the center of the universe" -- and
// back. Mostly-one, occasionally-the-other, not a 50/50 rotation.
const LOCATION_TAG_MAIN = 'Grand Rapids · 616';
const LOCATION_TAG_ALT = 'A grand display of digital rapids';
const LOCATION_TAG_ALT_INTERVAL_MS = 26_000;
const LOCATION_TAG_ALT_DURATION_MS = 4_000;

export interface IntroScreenProps {
  onBegin: () => void;
  /** Optional -- omitted entirely (renders nothing) if the caller doesn't wire it up. */
  onSignIn?: () => void;
}

export function IntroScreen({ onBegin, onSignIn }: IntroScreenProps) {
  // Same `available` gate every other account surface in this codebase
  // uses (AccountPanel, AccountNudge) -- stays invisible until auth is
  // actually configured, and never shown to someone already signed in.
  const { available, session } = useAuth();
  const showSignIn = Boolean(onSignIn) && available && !session;
  const { meta, cycleStarterUiLook, checkHiddenThemeReload } = useMeta();
  const player = useMusicPlayer();
  // Picked once per mount, not per render -- a fresh one shows up whenever
  // the title screen loads, Minecraft-main-menu-splash style.
  const splashText = useMemo(() => pickSplashText(), []);
  const introEvent = useMemo(() => resolveIntroEvent(), []);
  const physicsProfile = useMemo(() => introPhysicsForTheme(meta.uiTheme, introEvent), [introEvent, meta.uiTheme]);

  const [showAltLocationTag, setShowAltLocationTag] = useState(false);
  useEffect(() => {
    let revertTimer: ReturnType<typeof setTimeout> | undefined;
    const cycleTimer = setInterval(() => {
      setShowAltLocationTag(true);
      revertTimer = setTimeout(() => setShowAltLocationTag(false), LOCATION_TAG_ALT_DURATION_MS);
    }, LOCATION_TAG_ALT_INTERVAL_MS);
    return () => {
      clearInterval(cycleTimer);
      if (revertTimer) clearTimeout(revertTimer);
    };
  }, []);

  useEffect(() => {
    checkHiddenThemeReload();
  }, [checkHiddenThemeReload]);

  // Try to start Data Spark, the title-screen default track, the moment the
  // intro loads. Most browsers block audio before any user gesture, so this
  // attempt is allowed to fail quietly -- no banner, no prompt. The first
  // pointer or key interaction anywhere on the intro (theme cycle, "Enter
  // the hideout", or just a stray tap) retries once -- a separate flag from
  // the initial attempt, so the retry actually runs even though that first
  // attempt is expected to fail -- which is enough of a gesture to satisfy
  // the autoplay policy without the player ever noticing a step happened.
  useEffect(() => {
    if (player.isPlaying) return;
    const attemptStart = () => {
      player.ensureAudioContext();
      player.togglePlay();
    };
    attemptStart();
    let retried = false;
    const retryOnGesture = () => {
      if (retried) return;
      retried = true;
      attemptStart();
    };
    window.addEventListener('pointerdown', retryOnGesture, { once: true, capture: true });
    window.addEventListener('keydown', retryOnGesture, { once: true, capture: true });
    return () => {
      window.removeEventListener('pointerdown', retryOnGesture, { capture: true });
      window.removeEventListener('keydown', retryOnGesture, { capture: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="intro-screen min-h-[100dvh] flex flex-col items-center justify-center p-6 sm:p-8 text-center bg-black text-white relative overflow-hidden"
      data-intro-event={introEvent}
    >
      {/* A bot-piloted run of the real game plays behind the copy below --
          random character, random area, rotating scenes. See AttractMode.tsx. */}
      <Suspense fallback={null}>
        <AttractMode />
      </Suspense>
      <div className="intro-screen__atmosphere absolute inset-0 pointer-events-none" />

      {showSignIn ? (
        <motion.button
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.4 }}
          onClick={onSignIn}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 rounded-full border border-white/15 bg-black/30 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-white/60 hover:text-white/90 hover:border-white/30 transition-colors"
          data-testid="button-intro-sign-in"
        >
          Sign in
        </motion.button>
      ) : null}
      
      <IntroPhysicsProvider
        enabled={meta.introTitlePhysicsEnabled}
        returnDelaySec={meta.introTitleReturnDelaySec}
        profile={physicsProfile}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="intro-screen__content relative z-10 flex w-full max-w-xl flex-col items-center"
        >
          <IntroPhysicsBody id="location" order={0} className="mb-6">
            <AnimatePresence mode="wait">
              <motion.p
                key={showAltLocationTag ? 'alt' : 'main'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="intro-location text-primary text-xs uppercase tracking-[0.4em] font-bold"
                data-testid="text-intro-location-tag"
              >
                {showAltLocationTag ? LOCATION_TAG_ALT : LOCATION_TAG_MAIN}
              </motion.p>
            </AnimatePresence>
          </IntroPhysicsBody>

          <IntroTitle oneLine={meta.oneLineTitleEnabled} />

          {meta.splashTextEnabled ? (
            <IntroPhysicsBody
              id="splash"
              order={3}
              className="intro-splash intro-splash--centered"
              testId="text-intro-splash"
            >
              {splashText}
            </IntroPhysicsBody>
          ) : null}

          <ThemeCycleButton theme={meta.uiTheme} onCycle={cycleStarterUiLook} />

          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onBegin}
            className="intro-enter group relative w-full overflow-hidden bg-primary px-10 py-5 font-display text-base font-black uppercase tracking-[.14em] text-primary-foreground sm:w-auto"
            data-testid="button-begin"
          >
            <div className="absolute inset-0 translate-y-[100%] bg-white transition-transform duration-300 ease-out group-hover:translate-y-[0%]" />
            <span className="relative z-10 transition-colors duration-300 group-hover:text-black">Enter the hideout</span>
          </motion.button>

          <a
            href="https://gsix.online"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 self-center text-center font-mono text-[8px] uppercase tracking-[0.1em] text-white/20 transition-colors hover:text-white/50"
            data-testid="link-intro-credit"
          >
            Powered by LokServices · Designed by GSixDesigns
          </a>
        </motion.div>
        <IntroPhysicsReset />
      </IntroPhysicsProvider>
    </div>
  );
}

/**
 * Docked bottom-right, mirroring the music chip's move to the opposite
 * corner. Nudges further right while the Reset button (bottom-left) is up,
 * then eases back the moment Reset disappears -- a small tell that ties the
 * two corners together while the title is off its resting spot.
 */
function ThemeCycleButton({ theme, onCycle }: { theme: string; onCycle: () => void }) {
  const resetVisible = useIntroPhysicsResetVisible();
  return (
    <motion.button
      type="button"
      onClick={onCycle}
      title={`Theme: ${theme.replace(/-/g, ' ')} · tap to switch`}
      aria-label={`Switch starter look (current theme: ${theme.replace(/-/g, ' ')})`}
      animate={{ x: resetVisible ? 56 : 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="fixed bottom-3 right-3 z-20 grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-black/35 text-white/80 backdrop-blur-sm transition-colors hover:border-primary hover:text-primary"
      data-testid="button-intro-cycle-theme"
    >
      <Palette className="h-3.5 w-3.5" aria-hidden="true" />
    </motion.button>
  );
}

export default IntroScreen;
