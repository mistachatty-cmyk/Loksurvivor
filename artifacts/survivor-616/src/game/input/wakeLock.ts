/**
 * Screen Wake Lock for the duration of a run, so a phone doesn't dim/sleep
 * mid-run. Off by default (battery-relevant), unlike haptics.
 *
 * The lock auto-releases whenever the tab is hidden -- that's the platform's
 * own behavior, not a bug -- so it must be re-requested on every return to
 * `visibilitychange === 'visible'`, not just once on mount.
 */

import { useEffect } from 'react';

export function wakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !wakeLockSupported()) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = () => {
      navigator.wakeLock
        .request('screen')
        .then((lock) => {
          if (cancelled) {
            void lock.release();
            return;
          }
          sentinel = lock;
        })
        .catch(() => {
          // Denied or unsupported in this context -- silently stay awake-less.
        });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !sentinel) acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void sentinel?.release();
      sentinel = null;
    };
  }, [enabled]);
}
