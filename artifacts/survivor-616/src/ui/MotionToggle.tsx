/**
 * Lets a player override their device's reduced-motion setting for this game.
 * Some phones and low-power modes switch it on without the player knowing,
 * which freezes the title-screen live feed, hideout rain and parallax, and the
 * walking operative. The choice is stored on this device only.
 */
import { deviceWantsReducedMotion, getMotionMode, liveFeedPausedByDevice, setMotionMode } from '@/anim/motion';

function applyAndReload(mode: 'system' | 'full') {
  setMotionMode(mode);
  // Several scenes read the setting once when they mount, so a reload is the
  // one reliable way to restart every animation loop.
  window.location.reload();
}

/** Title-screen notice, shown only when the device has paused the live feed. */
export function MotionNotice() {
  if (!liveFeedPausedByDevice()) return null;
  return (
    <button
      type="button"
      onClick={() => applyAndReload('full')}
      className="mt-3 inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-amber-300/50 bg-amber-300/10 px-3 py-1.5 text-center font-mono text-[10px] font-bold uppercase tracking-wider text-amber-100 shadow-[0_0_18px_rgba(251,191,36,0.26)] transition-colors hover:border-amber-200/80 hover:bg-amber-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
      data-testid="button-motion-notice"
    >
      <span className="size-1.5 shrink-0 rounded-full bg-amber-200 shadow-[0_0_8px_rgba(251,191,36,0.9)]" aria-hidden="true" />
      Live feed paused by your device · Tap to turn on
    </button>
  );
}

/** Settings row. */
export function MotionSetting() {
  const mode = getMotionMode();
  const deviceReduced = deviceWantsReducedMotion();
  return (
    <div className="mt-3 border border-border/70 bg-background/50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide text-white">Always animate</h3>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Keeps the title live feed, hideout rain and parallax, and the walking operative running even when your
            device asks apps to reduce motion.
            {deviceReduced ? ' Your device is currently asking for reduced motion.' : ''} Changing this reloads the game.
          </p>
        </div>
        <button
          type="button"
          onClick={() => applyAndReload(mode === 'full' ? 'system' : 'full')}
          aria-pressed={mode === 'full'}
          className={`shrink-0 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
            mode === 'full'
              ? 'border-fuchsia-300/60 bg-fuchsia-400/15 text-fuchsia-100'
              : 'border-border bg-background text-muted-foreground hover:border-fuchsia-300/60 hover:text-white'
          }`}
          data-testid="button-toggle-always-animate"
        >
          {mode === 'full' ? 'On' : 'Off'}
        </button>
      </div>
    </div>
  );
}
