import { useEffect } from 'react';

/**
 * Keeps the screen from sleeping while `active` is true (the Jukebox Room while music plays), so a
 * song can be watched through to the end. The browser drops the lock whenever the page is hidden,
 * so it is asked for again when the page comes back. Browsers without support, or that refuse (low
 * battery), are simply left alone: nothing here may ever throw.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.hidden || lock) return;
      try {
        const next = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void next.release().catch(() => {});
          return;
        }
        lock = next;
        next.addEventListener('release', () => {
          if (lock === next) lock = null;
        });
      } catch {
        /* refused: the screen just sleeps as usual */
      }
    };
    const onVisible = () => {
      if (!document.hidden) void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => {});
      lock = null;
    };
  }, [active]);
}
