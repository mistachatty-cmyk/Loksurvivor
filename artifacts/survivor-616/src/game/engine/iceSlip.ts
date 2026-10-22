/**
 * Ice physics, kept pure so it can be tested without a world.
 *
 * Normal ground gives full steering: the wanted velocity is the velocity. On ice the actor keeps
 * its momentum and only slowly turns toward what it wants (`ICE_GRIP_RATE` per second), so anything
 * walking across an icy trail slides on past where it meant to stop or turn. Leaving the ice blends
 * back to full grip quickly (`GROUND_GRIP_RATE`) instead of snapping, which reads as a slide-out.
 */

/** How fast velocity turns toward the wanted velocity on ice (per second). Low = slippery. */
export const ICE_GRIP_RATE = 1.9;
/** How fast it recovers once back on solid ground (per second). */
export const GROUND_GRIP_RATE = 9;
/** Friction multiplier (per 60 Hz frame) a sliding prop keeps on ice. Closer to 1 = slides farther. */
export const ICE_PROP_FRICTION = 0.993;
/** A block must be moving at least this fast (px/s) to leave an icy trail. */
export const ICE_TRAIL_MIN_SPEED = 46;

export interface SlipState {
  slipVx?: number;
  slipVy?: number;
}

/**
 * Blends an actor's carried velocity toward the velocity it wants this frame and returns the one
 * to move with. Also stores it on the actor for the next frame.
 */
export function slipVelocity(actor: SlipState, wantX: number, wantY: number, dt: number, onIce: boolean): { x: number; y: number } {
  const hasMomentum = actor.slipVx !== undefined && actor.slipVy !== undefined;
  if (!onIce && !hasMomentum) return { x: wantX, y: wantY };
  const carriedX = actor.slipVx ?? wantX;
  const carriedY = actor.slipVy ?? wantY;
  const k = 1 - Math.exp(-dt * (onIce ? ICE_GRIP_RATE : GROUND_GRIP_RATE));
  const x = carriedX + (wantX - carriedX) * k;
  const y = carriedY + (wantY - carriedY) * k;
  if (!onIce && Math.abs(x - wantX) < 1 && Math.abs(y - wantY) < 1) {
    // Fully back to normal: drop the carried velocity so ground movement costs nothing again.
    actor.slipVx = undefined;
    actor.slipVy = undefined;
    return { x: wantX, y: wantY };
  }
  actor.slipVx = x;
  actor.slipVy = y;
  return { x, y };
}
