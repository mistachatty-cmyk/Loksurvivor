/**
 * The three theater levels.
 *
 * A listener who has not touched the screen for a while should be left alone
 * with the music: the interface fades, and the sound opens up. This module is
 * the whole rule as a pure function of "how long since the last touch", so it
 * can be tested without a browser, a timer or an AudioContext.
 *
 *   Level 1  Active   UI full opacity, dampen 3.5   the first 4 s after a touch
 *   Level 2  Dim      UI translucent,  dampen 1.5   the next 20 s
 *   Level 3  Theater  UI hidden,       dampen 0     until the next touch
 *
 * "Dampen" is a muffling amount: higher is more muffled, 0 is full and clear.
 * Moving between levels is always a smooth ramp, which the caller does (a CSS
 * transition for the UI, a `setTargetAtTime` for the audio). These functions
 * only say which level applies and when the next change is due.
 */

export const THEATER_ACTIVE_MS = 4000;
export const THEATER_DIM_MS = 20000;

export const THEATER_LEVELS = Object.freeze([
  Object.freeze({ level: 1, name: 'active', uiOpacity: 1, dampen: 3.5 }),
  Object.freeze({ level: 2, name: 'dim', uiOpacity: 0.35, dampen: 1.5 }),
  Object.freeze({ level: 3, name: 'theater', uiOpacity: 0, dampen: 0 }),
]);

function settings(options) {
  const o = options || {};
  return {
    paused: o.paused === true,
    theaterMix: o.theaterMix !== false,
    activeMs: Number.isFinite(o.activeMs) && o.activeMs >= 0 ? o.activeMs : THEATER_ACTIVE_MS,
    dimMs: Number.isFinite(o.dimMs) && o.dimMs >= 0 ? o.dimMs : THEATER_DIM_MS,
  };
}

/**
 * Which level applies `msSinceTouch` after the last touch.
 *
 * - While paused the interface stays at Level 1 (nobody is being left alone with
 *   anything, and a paused player with no controls is just a black screen).
 * - With `theaterMix` off the sound is never dampened; only the UI fades.
 */
export function levelAt(msSinceTouch, options) {
  const s = settings(options);
  const ms = Number.isFinite(msSinceTouch) && msSinceTouch > 0 ? msSinceTouch : 0;
  let index = 2;
  if (s.paused || ms < s.activeMs) index = 0;
  else if (ms < s.activeMs + s.dimMs) index = 1;
  const base = THEATER_LEVELS[index];
  return {
    level: base.level,
    name: base.name,
    uiOpacity: base.uiOpacity,
    dampen: s.theaterMix ? base.dampen : 0,
  };
}

/**
 * Milliseconds until the level next changes, or `null` when it will not change
 * on its own (Level 3, or paused). A caller sets one timeout from this instead
 * of polling.
 */
export function nextChangeIn(msSinceTouch, options) {
  const s = settings(options);
  if (s.paused) return null;
  const ms = Number.isFinite(msSinceTouch) && msSinceTouch > 0 ? msSinceTouch : 0;
  if (ms < s.activeMs) return s.activeMs - ms;
  if (ms < s.activeMs + s.dimMs) return s.activeMs + s.dimMs - ms;
  return null;
}
