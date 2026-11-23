/**
 * Pure helpers for the music player's "a song did not start" handling, kept free of the DOM so
 * they can be unit tested.
 */

/** The browser cancels a pending `play()` when a newer track is loaded; that is not a failed song. */
export function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';
}

/**
 * True when `url` lives on another origin than `pageOrigin`. Blob, data and relative URLs are same-origin.
 * Audio routed through Web Audio plays as silence unless a cross-origin file was requested with CORS.
 */
export function isCrossOriginUrl(url: string, pageOrigin: string): boolean {
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) return false;
  try {
    return new URL(url, pageOrigin).origin !== pageOrigin;
  } catch {
    return false;
  }
}

export type FailureAction = 'retry' | 'skip' | 'stop';

/**
 * What to do when a track fails to start or stream.
 * - first failure of a track: retry it once (a dropped connection often clears);
 * - failed again: skip to the next song, but never loop forever, so stop once every
 *   song in the queue has failed in a row.
 */
export function nextFailureAction(state: {
  alreadyRetried: boolean;
  consecutiveFailures: number;
  queueLength: number;
}): FailureAction {
  if (!state.alreadyRetried) return 'retry';
  if (state.queueLength > 1 && state.consecutiveFailures < state.queueLength) return 'skip';
  return 'stop';
}
