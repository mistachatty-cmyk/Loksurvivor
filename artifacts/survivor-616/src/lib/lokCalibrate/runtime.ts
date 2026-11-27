/**
 * runtime.ts -- the browser-facing half of Lok Calibrate: reads device facts, runs a short frame
 * test, remembers the player's choice and publishes the active settings for games to read.
 * Nothing leaves the device and nothing is stored but the on/off choice.
 */
import { createPref } from '../devicePref';
import { buildProfile, type CalibrationProfile, type CalibrationSettings, type DeviceFacts } from './core';

/** ask: show the prompt once per session; on: calibrated; off: never ask again. */
export type CalibrateMode = 'ask' | 'on' | 'off';
export const calibrateModePref = createPref<CalibrateMode>('lok.calibrate.mode.v1', 'ask', (raw): raw is CalibrateMode => raw === 'ask' || raw === 'on' || raw === 'off');

export function readDeviceFacts(): DeviceFacts {
  if (typeof navigator === 'undefined') return { ua: '' };
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const mq = (q: string): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(q).matches;
  const pads = typeof navigator.getGamepads === 'function' ? Array.from(navigator.getGamepads()) : [];
  return {
    ua: navigator.userAgent,
    cores: nav.hardwareConcurrency || undefined,
    memoryGb: nav.deviceMemory,
    dpr: typeof window !== 'undefined' ? window.devicePixelRatio : undefined,
    screenW: typeof screen !== 'undefined' ? screen.width : undefined,
    screenH: typeof screen !== 'undefined' ? screen.height : undefined,
    touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    coarsePointer: mq('(pointer: coarse)'),
    gamepad: pads.some((p) => p?.connected),
    saveData: nav.connection?.saveData === true,
    reducedMotion: mq('(prefers-reduced-motion: reduce)'),
  };
}

/** Average frame time over about `ms` of real animation frames; resolves null when frames never run (hidden tab). */
export function measureFrames(ms = 1200): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'function') return resolve(null);
    let last = 0;
    let sum = 0;
    let n = 0;
    const start = performance.now();
    const tick = (now: number) => {
      if (last && now - last < 250) {
        sum += now - last;
        n += 1;
      }
      last = now;
      if (now - start < ms) requestAnimationFrame(tick);
      else resolve(n >= 8 ? sum / n : null);
    };
    requestAnimationFrame(tick);
  });
}

let active: CalibrationProfile | null = null;
const listeners = new Set<() => void>();

export function activeCalibration(): CalibrationProfile | null {
  return active;
}
export function onCalibration(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Settings a game should honor right now, or null when calibration is off. */
export function calibratedSettings(): CalibrationSettings | null {
  return active ? active.settings : null;
}

export function applyProfile(p: CalibrationProfile | null): void {
  active = p;
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (p) {
      root.dataset.lokQuality = p.tier;
      root.style.setProperty('--lok-particles', String(p.settings.particleScale));
    } else {
      delete root.dataset.lokQuality;
      root.style.removeProperty('--lok-particles');
    }
  }
  listeners.forEach((l) => l());
}

/** Turn calibration on: apply the spec-based profile now, then refine it from a live frame test. */
export async function calibrateNow(): Promise<CalibrationProfile> {
  const facts = readDeviceFacts();
  const first = buildProfile(facts);
  applyProfile(first);
  const ms = await measureFrames();
  if (ms !== null) {
    const refined = buildProfile(facts, ms);
    applyProfile(refined);
    return refined;
  }
  return first;
}

export function turnOff(): void {
  applyProfile(null);
}
