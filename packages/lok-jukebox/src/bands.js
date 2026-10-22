/**
 * Slow audio grading.
 *
 * The room's color grade should drift with the music over seconds, not flicker
 * with every kick drum. Bands come in already smoothed by the game's analyser;
 * this adds a second, deliberately slow, asymmetric smoothing (quick enough to
 * feel a drop, slow to let go) and maps the result to a few bounded numbers a
 * stylesheet can use.
 */

function clamp01(n) {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

/** Group the five analyser bands into the three the grade uses. */
export function groupBands(bands) {
  const b = bands || {};
  return {
    bass: clamp01(Math.max(clamp01(b.sub), clamp01(b.bass))),
    mid: clamp01((clamp01(b.lowMid) + clamp01(b.mid)) / 2),
    treble: clamp01(b.high),
  };
}

export const RISE_MS = 900;
export const FALL_MS = 2400;

/** One slow step toward `next`; rises faster than it falls. `dtMs` is clamped so a stalled tab cannot jump. */
export function smoothBands(prev, next, dtMs) {
  const dt = Math.min(Math.max(Number.isFinite(dtMs) ? dtMs : 0, 0), 250);
  const out = {};
  for (const key of ['bass', 'mid', 'treble']) {
    const from = clamp01(prev && prev[key]);
    const to = clamp01(next && next[key]);
    const tau = to > from ? RISE_MS : FALL_MS;
    out[key] = from + (to - from) * (1 - Math.exp(-dt / tau));
  }
  return out;
}

/** Bounded CSS-ready grade values from smoothed bands and overall energy. */
export function gradeFrom(bands, energy) {
  const g = groupBands(bands);
  const e = clamp01(energy);
  return {
    /** 0.2 to 1: how bright the glow behind the discs is. */
    glow: Math.round((0.2 + 0.8 * g.bass) * 1000) / 1000,
    /** -20 to 20 degrees: a gentle hue drift. */
    hue: Math.round((g.mid - 0.5) * 40 * 100) / 100,
    /** 0.45 to 0.8: how dark the edges are; quiet music leaves the room darker. */
    vignette: Math.round((0.8 - 0.35 * e) * 1000) / 1000,
    /** 0.02 to 0.1: film grain strength. */
    grain: Math.round((0.02 + 0.08 * g.treble) * 1000) / 1000,
  };
}

export const IDLE_BANDS = Object.freeze({ bass: 0, mid: 0, treble: 0 });
