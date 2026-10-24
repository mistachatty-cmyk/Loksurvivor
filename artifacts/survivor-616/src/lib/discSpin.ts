/**
 * Spinning a disc with a finger or mouse, the way a record turns: the disc follows the pointer
 * around its centre, and a flick lets it coast to a stop. Pure math only (angles in degrees,
 * speeds in degrees per second); `DiscSpinSurface` does the pointer wiring.
 */

/** Fastest a flick may spin, so a wild swipe cannot blur the disc into a strobe. */
export const MAX_SPIN_SPEED = 1800;
/** Below this the disc counts as stopped. */
export const REST_SPEED = 8;
/** How quickly a coasting disc slows: speed is multiplied by e^(-FRICTION * seconds). */
export const FRICTION = 1.9;

/** Angle of a point around a centre, 0 at the right, growing clockwise on screen. */
export function angleAround(cx: number, cy: number, x: number, y: number): number {
  return (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
}

/** The smallest turn that gets from one angle to another, in (-180, 180]. */
export function turnBetween(from: number, to: number): number {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

export interface SpinSample {
  /** Milliseconds. */
  t: number;
  /** Total angle turned so far, in degrees. */
  angle: number;
}

/** Speed of a release, from the last few samples of the drag. Looks only at the final 120 ms. */
export function releaseSpeed(samples: readonly SpinSample[]): number {
  const last = samples[samples.length - 1];
  if (!last) return 0;
  const recent = samples.filter((s) => last.t - s.t <= 120);
  const first = recent[0];
  if (!first || last.t - first.t < 8) return 0;
  const speed = ((last.angle - first.angle) / (last.t - first.t)) * 1000;
  return Math.max(-MAX_SPIN_SPEED, Math.min(MAX_SPIN_SPEED, speed));
}

/** One coasting step: the angle moved and the speed that is left. */
export function coast(angle: number, speed: number, dtMs: number): { angle: number; speed: number } {
  const dt = Math.min(dtMs, 64) / 1000;
  const next = speed * Math.exp(-FRICTION * dt);
  return { angle: angle + ((speed + next) / 2) * dt, speed: Math.abs(next) < REST_SPEED ? 0 : next };
}

/** True when a press that barely moved should count as a tap. */
export function isTap(travelPx: number, durationMs: number): boolean {
  return travelPx < 8 && durationMs < 450;
}
