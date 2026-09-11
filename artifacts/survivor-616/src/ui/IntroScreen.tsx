/**
 * Cold open. Sets the premise before the player ever sees the hideout.
 * Owned by the design pass -- keep the export name and props stable.
 */
import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';

import { useAuth } from '@/state/authStore';

// Pulls in the full simulation engine (createWorld/stepWorld/renderWorld),
// which is otherwise only paid for once a real run starts. Lazy-loading it
// here keeps the intro's first paint just as fast as before -- the engine
// bundle loads in the background and the canvas fades in once it's ready,
// same pattern this codebase already uses for RunScreen/StudioScreen.
const AttractMode = lazy(() => import('@/ui/AttractMode').then((m) => ({ default: m.AttractMode })));

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

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-8 text-center bg-black text-white relative overflow-hidden">
      {/* A bot-piloted run of the real game plays behind the copy below --
          random character, random area, rotating scenes. See AttractMode.tsx. */}
      <Suspense fallback={null}>
        <AttractMode />
      </Suspense>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,transparent_70%)] pointer-events-none" />

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
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center max-w-lg w-full"
      >
        <p className="text-primary text-xs uppercase tracking-[0.4em] font-bold mb-6">Grand Rapids · 616</p>
        
        <h1 className="text-6xl md:text-8xl font-black mb-8 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
          616<br/>Survivor
        </h1>
        
        <p className="text-muted-foreground text-sm md:text-base leading-relaxed mb-12 max-w-sm">
          The block turned after dark. You have a basement bar, a crew worth saving, and one night at a time.
        </p>
        
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onBegin}
          className="group relative w-full sm:w-auto px-10 py-5 bg-primary text-primary-foreground uppercase tracking-widest font-black text-sm overflow-hidden"
          data-testid="button-begin"
        >
          <div className="absolute inset-0 bg-white translate-y-[100%] group-hover:translate-y-[0%] transition-transform duration-300 ease-out" />
          <span className="relative z-10 group-hover:text-black transition-colors duration-300">Enter the hideout</span>
        </motion.button>
      </motion.div>
    </div>
  );
}

export default IntroScreen;
