/**
 * Device-tilt movement input.
 *
 * Reads `deviceorientation` and turns it into the same normalised -1..1
 * movement pair the joystick and keyboard produce, so the run loop merges all
 * three the same way.
 *
 * Returns a ref rather than state on purpose: orientation fires far faster than
 * the UI needs to re-render, and the run loop reads it once per frame anyway.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface GyroReading {
  /** -1..1, left/right. */
  x: number;
  /** -1..1, forward/back. */
  y: number;
  /** True once orientation events are actually arriving. */
  active: boolean;
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

function applyCurve(degrees: number, sensitivity: number): number {
  const magnitude = Math.abs(degrees);
  if (magnitude <= DEADZONE_DEG) return 0;
  const span = Math.max(1, FULL_TILT_DEG / sensitivity - DEADZONE_DEG);
  const normalised = Math.min(1, (magnitude - DEADZONE_DEG) / span);
  return Math.sign(degrees) * normalised;
}

export function useGyroInput({ enabled, sensitivity = 1, invertY = false }: GyroOptions) {
  const readingRef = useRef<GyroReading>({ x: 0, y: 0, active: false });
  /**
   * Neutral pose captured when the player recentres. Without it, playing lying
   * down or slouched means permanently holding a direction.
   */
  const originRef = useRef<{ beta: number; gamma: number } | null>(null);
  const latestRef = useRef<{ beta: number; gamma: number } | null>(null);
  const [active, setActive] = useState(false);

  /** Treats the current pose as neutral. Safe to call before any event lands. */
  const recenter = useCallback(() => {
    originRef.current = latestRef.current ? { ...latestRef.current } : { beta: 0, gamma: 0 };
  }, []);

  useEffect(() => {
    if (!enabled || !gyroSupported()) {
      readingRef.current = { x: 0, y: 0, active: false };
      setActive(false);
      return;
    }

    const onOrientation = (event: DeviceOrientationEvent) => {
      const { beta, gamma } = event;
      if (beta === null || gamma === null) return;
      latestRef.current = { beta, gamma };
      // First reading doubles as the neutral pose, so play starts centred.
      if (!originRef.current) originRef.current = { beta, gamma };
      const origin = originRef.current;

      const rawX = applyCurve(gamma - origin.gamma, sensitivity);
      const rawY = applyCurve(beta - origin.beta, sensitivity) * (invertY ? -1 : 1);

      const previous = readingRef.current;
      readingRef.current = {
        x: previous.x * SMOOTHING + rawX * (1 - SMOOTHING),
        y: previous.y * SMOOTHING + rawY * (1 - SMOOTHING),
        active: true,
      };
      if (!previous.active) setActive(true);
    };

    window.addEventListener('deviceorientation', onOrientation);
    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      readingRef.current = { x: 0, y: 0, active: false };
      setActive(false);
    };
  }, [enabled, sensitivity, invertY]);

  return { readingRef, recenter, active };
}
