import { isSavingPower } from './powerSaver';

/**
 * Warms the screens a player is most likely to open next, once the browser is idle, so opening them
 * feels instant even though they load on demand. Skipped entirely while the battery saver is on or
 * the browser's Data Saver is requested, so it never spends data or battery the player asked to keep.
 */
export function prefetchWhenIdle(loaders: ReadonlyArray<() => Promise<unknown>>): () => void {
  let cancelled = false;
  let handle = 0;
  const idle: (cb: () => void) => number =
    typeof window.requestIdleCallback === 'function' ? (cb) => window.requestIdleCallback(cb, { timeout: 8000 }) : (cb) => window.setTimeout(cb, 3000);
  const cancel = typeof window.cancelIdleCallback === 'function' ? window.cancelIdleCallback.bind(window) : window.clearTimeout.bind(window);
  let next = 0;
  const step = () => {
    if (cancelled || next >= loaders.length) return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (isSavingPower() || conn?.saveData) return;
    void loaders[next++]!().catch(() => undefined);
    handle = idle(step);
  };
  handle = idle(step);
  return () => {
    cancelled = true;
    cancel(handle);
  };
}
