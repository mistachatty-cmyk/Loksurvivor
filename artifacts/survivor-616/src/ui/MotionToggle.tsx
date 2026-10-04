/**
 * Lets a player override their device's reduced-motion setting for this game.
 * Some phones and low-power modes switch it on without the player knowing,
 * which freezes the title-screen live feed, hideout rain and parallax, and the
 * walking operative. The choice is stored on this device only.
 */
import { deviceWantsReducedMotion, getMotionMode, setMotionMode } from '@/anim/motion';

function applyAndReload(mode: 'system' | 'full') {
  setMotionMode(mode);
  // Several scenes read the setting once when they mount, so a reload is the
  // one reliable way to restart every animation loop.
  window.location.reload();
}

/** Small title-screen notice, shown only when the device is holding animations back. */
export function MotionNotice() {
  if (!deviceWantsReducedMotion() || getMotionMode() === 'full') return null;
  return (
    <button
      type="button"
      onClick={() => applyAndReload('full')}
      className="mt-2 font-mono text-[9px] uppercase tracking-widest text-amber-300/80 underline-offset-2 hover:text-amber-200 hover:underline"
      data-testid="button-motion-notice"
    >
      Animations are paused by your device setting. Tap to always animate.
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
