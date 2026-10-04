/**
 * Cold open. Sets the premise before the player ever sees the hideout.
 * Owned by the design pass -- keep the export name and props stable.
 */
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Palette, X, ShieldAlert, Sparkles, Megaphone, Wrench } from 'lucide-react';

import { useAuth } from '@/state/authStore';
import { useMeta } from '@/game/state/metaStore';
import { useMusicPlayer } from '@/game/audio/musicPlayer';
import { pickSplashText } from '@/game/data/splashText';
import { LORE_CHRONICLES } from '@/game/data/lore';
import { LorePopup } from '@/ui/LorePopup';
import { CHANGELOG, CURRENT_VERSION, updateNumber } from '@/game/data/changelog';
import { pickCreditName } from '@/game/data/creditRotation';
import { IntroTitle } from '@/ui/IntroTitle';
import { useT } from '@/lib/i18n';
import { FireflyEasterEgg } from '@/ui/FireflyEasterEgg';
import { MotionNotice } from '@/ui/MotionToggle';
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
  const t = useT();
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
  const [showLoreModal, setShowLoreModal] = useState(false);
  const [showUpdatesModal, setShowUpdatesModal] = useState(false);
  const credit = useMemo(() => pickCreditName(), []);

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

          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onBegin}
            className="intro-enter group relative w-full overflow-hidden bg-primary px-10 py-5 font-display text-base font-black uppercase tracking-[.14em] text-primary-foreground sm:w-auto"
            data-testid="button-begin"
          >
            <div className="absolute inset-0 translate-y-[100%] bg-white transition-transform duration-300 ease-out group-hover:translate-y-[0%]" />
            <span className="relative z-10 transition-colors duration-300 group-hover:text-black">{t('intro.enterHideout')}</span>
          </motion.button>

          {/* Mission Briefing Button (matches theme from screenshot) */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowLoreModal(true)}
            className="mt-3.5 flex w-full max-w-sm sm:max-w-md items-center justify-center gap-2 rounded-sm border border-red-500/80 bg-red-950/70 px-4 py-2 font-mono text-[10px] sm:text-xs font-bold uppercase tracking-wider text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.25)] transition-all hover:border-red-400 hover:bg-red-900/80 hover:text-red-100"
            data-testid="button-mission-briefing"
          >
            <ShieldAlert className="h-3.5 w-3.5 text-red-400 shrink-0" />
            <span>MISSION BRIEFING: THE AI TRAP & SOUL SIPHON</span>
          </motion.button>

          {/* Updates & Patch Notes Link */}
          <button
            type="button"
            onClick={() => setShowUpdatesModal(true)}
            className="mt-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-400 transition-colors hover:text-cyan-300 hover:underline"
            data-testid="button-intro-updates"
          >
            UPDATES & PATCH NOTES (V{CURRENT_VERSION})
          </button>

          <a
            href="https://gsix.online"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 self-center text-center font-mono text-[8px] uppercase tracking-[0.1em] text-white/20 transition-colors hover:text-white/50"
            data-testid="link-intro-credit"
          >
            POWERED BY LOKSERVICES · DESIGNED BY GSIXDESIGNS
          </a>
          <MotionNotice />
        </motion.div>
        {/* Both of these use `position: fixed`, which must escape to the
            viewport -- kept as siblings of motion.div, not nested inside it,
            because motion.div carries a Framer Motion filter: blur(0px) that
            (despite doing nothing visually) creates a CSS containing block
            for fixed descendants, same as a transform would. Nesting either
            one inside motion.div anchors it to that div's box instead of the
            screen corner. */}
        <ThemeCycleButton theme={meta.uiTheme} onCycle={cycleStarterUiLook} />
        <IntroPhysicsReset />
      </IntroPhysicsProvider>
      <FireflyEasterEgg />

      {/* Mission Briefing / Lore Screen Modal (Setup like UpdatePopup with button theme) */}
      <AnimatePresence>
        {showLoreModal && <LorePopup onClose={() => setShowLoreModal(false)} />}
      </AnimatePresence>

      {/* Updates Modal from Intro Screen */}
      <AnimatePresence>
        {showUpdatesModal && (
          <div
            className="fixed inset-0 z-[150] grid place-items-center overflow-y-auto bg-black/90 p-4 py-6 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={t('intro.updates.aria')}
            data-testid="section-intro-updates-popup"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
              className="relative w-full max-w-lg border-2 border-cyan-300/50 bg-gradient-to-b from-cyan-950/40 to-black p-5 shadow-[0_0_60px_rgba(103,232,249,0.15)] text-left"
            >
              <button
                type="button"
                onClick={() => setShowUpdatesModal(false)}
                className="absolute right-3 top-3 grid h-9 w-9 place-items-center border border-white/20 bg-black/70 text-white transition-all active:scale-[0.97] hover:border-white/50"
                aria-label={t('intro.updates.dismissAria')}
                data-testid="button-close-intro-updates-popup"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-2">
                <Megaphone className="h-6 w-6 shrink-0 text-cyan-300" />
                <div>
                  <p className="font-mono text-[10px] font-black uppercase tracking-[0.25em] text-cyan-300">
                    A Message From {credit}
                  </p>
                  <h2 className="text-2xl font-black uppercase text-white">{t('intro.updates.heading')}</h2>
                </div>
              </div>
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Current Version v{CURRENT_VERSION} · Total Updates: {CHANGELOG.length}
              </p>

              <div className="mt-4 max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                {[...CHANGELOG].reverse().map((entry) => (
                  <div
                    key={entry.version}
                    className={`border p-3 ${entry.kind === 'hotfix' ? 'border-amber-400/40 bg-amber-400/5' : 'border-cyan-300/25 bg-cyan-300/5'}`}
                    data-testid={`intro-update-entry-${entry.version}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[8px] font-black uppercase tracking-widest ${
                          entry.kind === 'hotfix'
                            ? 'border-amber-400/60 bg-amber-400/15 text-amber-300'
                            : 'border-cyan-300/60 bg-cyan-300/15 text-cyan-200'
                        }`}
                      >
                        {entry.kind === 'hotfix' ? <Wrench className="h-2.5 w-2.5" /> : <Megaphone className="h-2.5 w-2.5" />}
                        {entry.kind === 'hotfix' ? 'Hotfix' : 'Update'} #{updateNumber(entry)}
                      </span>
                      <span className="font-mono text-[9px] text-muted-foreground">v{entry.version} · {entry.date}</span>
                    </div>
                    <h3 className="mt-1.5 text-sm font-black uppercase text-white">{entry.title}</h3>
                    <ul className="mt-1.5 space-y-1">
                      {entry.body.map((line) => (
                        <li key={line} className="text-xs leading-snug text-muted-foreground">{line}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowUpdatesModal(false)}
                className="mt-4 w-full border border-cyan-300/60 bg-cyan-300/15 py-3 text-sm font-black uppercase tracking-widest text-cyan-100 transition-colors hover:bg-cyan-300/25"
                data-testid="button-acknowledge-intro-updates"
              >
                Let's Go
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Shares IntroPhysicsReset's exact bottom-left slot (same
 * bottom-4/left-4 sm:bottom-6/sm:left-6 anchor) rather than sitting
 * somewhere else on screen. Normally parked right there; when Reset needs
 * that spot -- the title is off its resting spot -- this slides out of the
 * way to the right, then slides back the moment Reset disappears.
 */
function ThemeCycleButton({ theme, onCycle }: { theme: string; onCycle: () => void }) {
  const resetVisible = useIntroPhysicsResetVisible();
  return (
    <motion.button
      type="button"
      onClick={onCycle}
      title={`Theme: ${theme.replace(/-/g, ' ')} · tap to switch`}
      aria-label={`Switch starter look (current theme: ${theme.replace(/-/g, ' ')})`}
      animate={{ x: resetVisible ? 88 : 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="fixed bottom-4 left-4 z-20 grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-black/35 text-white/80 backdrop-blur-sm transition-colors hover:border-primary hover:text-primary sm:bottom-6 sm:left-6"
      data-testid="button-intro-cycle-theme"
    >
      <Palette className="h-3.5 w-3.5" aria-hidden="true" />
    </motion.button>
  );
}

export default IntroScreen;
