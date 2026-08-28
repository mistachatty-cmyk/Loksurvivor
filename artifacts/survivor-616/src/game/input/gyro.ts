/**
 * Device-tilt movement input.
 *
 * Reads `deviceorientation` and turns it into the same normalised -1..1
 * movement pair the joystick and keyboard produce, so the run loop merges all
 * three the same way.
 *
 * Returns a ref rather than state on purpose: orientation fires far faster than
 * the UI needs to re-render, and the run loop reads it once per frame anyway.
 *
 * ## Why this is not just `gamma -> x, beta -> y`
 *
 * That mapping is only correct in portrait. Held sideways -- the natural way to
 * play this game -- the device's axes are rotated 90 degrees relative to the
 * screen the player is looking at, and steering comes out rotated with them.
 *
 * It also breaks down at the edges. `gamma` is reported over -90..90, and
 * holding a phone in landscape puts it *at* that limit, which is exactly where
 * Euler angles degenerate: near the boundary, tiny physical movements swing
 * `gamma` wildly, or flip its sign.
 *
 * Both problems disappear by working with the **gravity vector** instead of the
 * raw angles. Where gravity points, in the device's own frame, is a continuous
 * quantity with no boundary to fall off. Rotating that vector by the screen's
 * orientation angle gives tilt in the frame the player actually sees.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface GyroReading {
  /** -1..1, left/right in *screen* space. */
  x: number;
  /** -1..1, forward/back in *screen* space. */
  y: number;
  /** True once orientation events are actually arriving. */
  active: boolean;
  /** Raw sensor angle, for the settings readout. */
  beta: number;
  /** Raw sensor angle, for the settings readout. */
  gamma: number;
  /** Screen rotation the mapping is currently compensating for. */
  screenAngle: number;
}

export interface GyroOptions {
  enabled: boolean;
  /** 0.5 (gentle) .. 2 (twitchy). Scales the tilt needed for full deflection. */
  sensitivity?: number;
  invertY?: boolean;
}

/** Tilt below this many degrees is treated as holding still. */
const DEADZONE_DEG = 4;
/** Tilt at which the stick is fully deflected, before sensitivity scaling. */
const FULL_TILT_DEG = 22;
/** Low-pass factor -- hands shake, and raw orientation is noisy. */
const SMOOTHING = 0.8;

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export const NEUTRAL_READING: GyroReading = {
  x: 0,
  y: 0,
  active: false,
  beta: 0,
  gamma: 0,
  screenAngle: 0,
};

type PermissionCapableEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied' | 'prompt'>;
};

/** iOS 13+ gates orientation behind a permission prompt; nowhere else does. */
export function gyroNeedsPermission(): boolean {
  if (typeof DeviceOrientationEvent === 'undefined') return false;
  return typeof (DeviceOrientationEvent as PermissionCapableEvent).requestPermission === 'function';
}

export function gyroSupported(): boolean {
  return typeof window !== 'undefined' && typeof DeviceOrientationEvent !== 'undefined';
}

/**
 * Orientation is only delivered to a secure context. This is the failure worth
 * naming loudest: over plain `http://` -- which is what a phone gets when it
 * hits a dev server by LAN address -- no event ever fires and nothing reports
 * an error. It looks exactly like broken code.
 */
export function gyroNeedsSecureContext(): boolean {
  if (typeof window === 'undefined') return false;
  return !window.isSecureContext;
}

/**
 * Must be called from a user gesture on iOS. Resolves false when unavailable or
 * denied -- callers fall back to the joystick rather than surfacing an error.
 */
export async function requestGyroPermission(): Promise<boolean> {
  if (!gyroSupported()) return false;
  const request = (DeviceOrientationEvent as PermissionCapableEvent).requestPermission;
  if (typeof request !== 'function') return true;
  try {
    return (await request()) === 'granted';
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Pure mapping -- exported so it can be tested without a browser      */
/* ------------------------------------------------------------------ */

/** Where the screen is rotated relative to the device's natural orientation. */
export function screenAngle(): number {
  if (typeof window === 'undefined') return 0;
  const fromApi = window.screen?.orientation?.angle;
  if (typeof fromApi === 'number') return fromApi;
  // Deprecated, but still the only source on older iOS.
  const legacy = (window as typeof window & { orientation?: number }).orientation;
  return typeof legacy === 'number' ? legacy : 0;
}

/**
 * Exact cos/sin for the screen angle. Computed by lookup rather than by
 * `Math.cos` so the quarter turns are exactly 0 and 1 -- floating point fuzz
 * here would leak a sliver of one axis into the other, which reads as drift.
 */
export function orientationRotation(angle: number): { cos: number; sin: number } {
  switch (((Math.round(angle / 90) * 90) % 360 + 360) % 360) {
    case 90:
      return { cos: 0, sin: 1 };
    case 180:
      return { cos: -1, sin: 0 };
    case 270:
      return { cos: 0, sin: -1 };
    default:
      return { cos: 1, sin: 0 };
  }
}

/**
 * The unit gravity vector's x/y components in the device's own frame.
 *
 * `alpha` is deliberately ignored: it is the compass heading, and which way the
 * player happens to be facing has nothing to do with how they are tilting.
 */
export function gravityFromEuler(beta: number, gamma: number): { gx: number; gy: number } {
  const b = beta * DEG2RAD;
  const g = gamma * DEG2RAD;
  return {
    // Tilting the right edge down gives a positive gamma and so a positive gx,
    // which is the direction the player expects to move.
    gx: Math.cos(b) * Math.sin(g),
    gy: Math.sin(b),
  };
}

function applyCurve(degrees: number, sensitivity: number): number {
  const magnitude = Math.abs(degrees);
  if (magnitude <= DEADZONE_DEG) return 0;
  const span = Math.max(1, FULL_TILT_DEG / sensitivity - DEADZONE_DEG);
  const normalised = Math.min(1, (magnitude - DEADZONE_DEG) / span);
  return Math.sign(degrees) * normalised;
}

export interface TiltOrigin {
  gx: number;
  gy: number;
}

/**
 * Full device-tilt to screen-movement mapping.
 *
 * `origin` is the calibrated neutral pose, as a gravity vector. Working in
 * gravity space means the neutral can be any pose at all -- lying down, slouched
 * on a couch -- and the deltas stay meaningful.
 */
export function mapTilt(
  beta: number,
  gamma: number,
  origin: TiltOrigin,
  angle: number,
  sensitivity: number,
  invertY: boolean,
): { x: number; y: number } {
  const { gx, gy } = gravityFromEuler(beta, gamma);
  const deltaX = gx - origin.gx;
  const deltaY = gy - origin.gy;

  // Rotate the device-frame delta into the frame the player is looking at.
  const { cos, sin } = orientationRotation(angle);
  const screenX = deltaX * cos + deltaY * sin;
  const screenY = -deltaX * sin + deltaY * cos;

  // Near neutral a gravity delta equals the tilt in radians, so converting back
  // to degrees keeps the deadzone and full-tilt constants meaning what they say.
  return {
    x: applyCurve(screenX * RAD2DEG, sensitivity),
    y: applyCurve(screenY * RAD2DEG, sensitivity) * (invertY ? -1 : 1),
  };
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export function useGyroInput({ enabled, sensitivity = 1, invertY = false }: GyroOptions) {
  const readingRef = useRef<GyroReading>({ ...NEUTRAL_READING });
  /**
   * Neutral pose captured when the player recentres, as a gravity vector.
   * Without it, playing lying down means permanently holding a direction.
   */
  const originRef = useRef<TiltOrigin | null>(null);
  const latestRef = useRef<{ beta: number; gamma: number } | null>(null);
  const [active, setActive] = useState(false);

  /** Treats the current pose as neutral. Safe to call before any event lands. */
  const recenter = useCallback(() => {
    const latest = latestRef.current;
    originRef.current = latest ? gravityFromEuler(latest.beta, latest.gamma) : { gx: 0, gy: 0 };
  }, []);

  useEffect(() => {
    if (!enabled || !gyroSupported()) {
      readingRef.current = { ...NEUTRAL_READING };
      setActive(false);
      return;
    }

    const onOrientation = (event: DeviceOrientationEvent) => {
      const { beta, gamma } = event;
      if (beta === null || gamma === null) return;
      latestRef.current = { beta, gamma };
      // First reading doubles as the neutral pose, so play starts centred.
      originRef.current ??= gravityFromEuler(beta, gamma);

      const angle = screenAngle();
      const raw = mapTilt(beta, gamma, originRef.current, angle, sensitivity, invertY);

      const previous = readingRef.current;
      readingRef.current = {
        x: previous.x * SMOOTHING + raw.x * (1 - SMOOTHING),
        y: previous.y * SMOOTHING + raw.y * (1 - SMOOTHING),
        active: true,
        beta,
        gamma,
        screenAngle: angle,
      };
      if (!previous.active) setActive(true);
    };

    /**
     * Rotating the device changes the physical neutral pose completely, so the
     * stored origin becomes meaningless -- keeping it would yank the player
     * hard in one direction the moment the screen turns.
     */
    const onOrientationChange = () => {
      originRef.current = null;
      readingRef.current = { ...readingRef.current, x: 0, y: 0 };
    };

    window.addEventListener('deviceorientation', onOrientation);
    // Some Android browsers only ever fire the absolute variant.
    window.addEventListener('deviceorientationabsolute', onOrientation as EventListener);
    window.addEventListener('orientationchange', onOrientationChange);
    window.screen?.orientation?.addEventListener?.('change', onOrientationChange);

    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      window.removeEventListener('deviceorientationabsolute', onOrientation as EventListener);
      window.removeEventListener('orientationchange', onOrientationChange);
      window.screen?.orientation?.removeEventListener?.('change', onOrientationChange);
      readingRef.current = { ...NEUTRAL_READING };
      setActive(false);
    };
  }, [enabled, sensitivity, invertY]);

  return { readingRef, recenter, active };
}
