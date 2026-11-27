/**
 * lib/lokCalibrate/core.ts -- Lok Calibrate: device-aware performance profiles for the Lok ecosystem.
 *
 * The idea: a game should know what it is running on (console, TV, phone, tablet, laptop, desktop;
 * which browser and OS; how much power the hardware has) and, with one tap from the player, tune
 * itself to that device: canvas sharpness, frame-rate target, effect and particle weight, shadows,
 * default input and TV-safe margins. A short live frame test can then lower the tier if the device
 * runs slower than its specs suggest, so the profile follows what the device really does.
 *
 * Pure rules only (facts in, profile out): no DOM, no storage, no network. The one dependency is the
 * sibling console package for console profiles; nothing from any game (test-enforced). It is built
 * to ship as `@lok/calibrate` and be reused by every Lok game.
 */

import { consoleProfile, detectConsole, type ConsoleKind } from '../lokConsole/core';

export type DeviceClass = 'console' | 'tv' | 'phone' | 'tablet' | 'laptop' | 'desktop';
export type BrowserKind = 'edge' | 'chrome' | 'firefox' | 'safari' | 'samsung' | 'other';
export type OsKind = 'windows' | 'macos' | 'ios' | 'android' | 'linux' | 'xbox' | 'playstation' | 'switch' | 'tv' | 'other';
export type Tier = 'low' | 'mid' | 'high';

/** What the page can tell about the device. Every field except `ua` may be unknown. */
export interface DeviceFacts {
  ua: string;
  cores?: number;
  /** navigator.deviceMemory, in GB (capped at 8 by browsers; absent on Safari and Firefox). */
  memoryGb?: number;
  dpr?: number;
  screenW?: number;
  screenH?: number;
  touch?: boolean;
  coarsePointer?: boolean;
  gamepad?: boolean;
  saveData?: boolean;
  reducedMotion?: boolean;
  batteryLevel?: number | null;
  charging?: boolean;
}

export interface CalibrationSettings {
  /** Highest canvas pixel ratio to start at (the frame governor may still step below). */
  dprCap: number;
  fps: 30 | 60;
  effects: Tier;
  /** Multiplier for particle counts, 0.4 to 1. */
  particleScale: number;
  shadows: boolean;
  /** Input mode the device most likely uses, when it is clear. */
  inputMode: 'pointer' | 'keyboard' | 'gamepad' | null;
  /** Title-safe margin as a share of the screen, 0 when none is needed. */
  safeInset: number;
}

/** Reasons the profile gives; the UI maps each id to a short locale line. */
export type CalibrationNote = 'console-detected' | 'tv-30fps' | 'old-webkit' | 'ios-no-vibrate' | 'low-memory' | 'battery-low' | 'data-saver' | 'gamepad-found' | 'hi-dpi-capped' | 'measured-slow';

export interface CalibrationProfile {
  deviceClass: DeviceClass;
  browser: BrowserKind;
  os: OsKind;
  consoleKind: ConsoleKind;
  /** Human label such as "Xbox Series X|S" or "Windows desktop". */
  label: string;
  browserLabel: string;
  tier: Tier;
  settings: CalibrationSettings;
  notes: CalibrationNote[];
}

export function detectBrowser(ua: string): BrowserKind {
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (/Edg(e|A|iOS)?\//i.test(ua)) return 'edge';
  if (/Firefox|FxiOS/i.test(ua)) return 'firefox';
  if (/Chrome|CriOS|Chromium/i.test(ua)) return 'chrome';
  if (/Safari/i.test(ua)) return 'safari';
  return 'other';
}

export function detectOs(ua: string): OsKind {
  if (/xbox/i.test(ua)) return 'xbox';
  if (/playstation/i.test(ua)) return 'playstation';
  if (/nintendo/i.test(ua)) return 'switch';
  if (/tizen|web0s|webos|smart-?tv|crkey|aftb|bravia/i.test(ua)) return 'tv';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macos';
  if (/Linux|X11|CrOS/i.test(ua)) return 'linux';
  return 'other';
}

export function classifyDevice(f: DeviceFacts): DeviceClass {
  const ck = detectConsole(f.ua);
  if (ck === 'tv') return 'tv';
  if (ck !== 'none') return 'console';
  const ua = f.ua;
  const long = Math.max(f.screenW ?? 0, f.screenH ?? 0);
  const short = Math.min(f.screenW ?? 0, f.screenH ?? 0);
  if (/iPad|Tablet/i.test(ua) || (/Macintosh/i.test(ua) && f.touch)) return 'tablet';
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return 'tablet';
  if (/iPhone|iPod|Android.*Mobile|Mobile/i.test(ua)) return 'phone';
  if (f.touch && f.coarsePointer && short > 0 && short < 600) return 'phone';
  if (f.touch && f.coarsePointer && long > 0 && long < 1400) return 'tablet';
  return (f.cores ?? 4) <= 4 && !f.gamepad && (f.dpr ?? 1) >= 1.5 ? 'laptop' : 'desktop';
}

const lower = (t: Tier): Tier => (t === 'high' ? 'mid' : 'low');

/** Raw hardware tier from cores and memory, then device-class limits. */
export function tierOf(f: DeviceFacts, cls: DeviceClass, ck: ConsoleKind): Tier {
  if (ck === 'xbox-series' || ck === 'playstation-5') return 'high';
  if (ck === 'xbox-one' || ck === 'playstation-4') return 'mid';
  if (ck === 'switch' || cls === 'tv') return 'low';
  const cores = f.cores ?? 4;
  const mem = f.memoryGb ?? 4;
  const score = (cores <= 2 ? 0 : cores <= 4 ? 1 : cores <= 8 ? 2 : 3) + (mem <= 2 ? 0 : mem <= 4 ? 1 : 2);
  let tier: Tier = score <= 1 ? 'low' : score <= 3 ? 'mid' : 'high';
  if (cls === 'phone' && tier === 'high' && mem < 6) tier = 'mid';
  return tier;
}

/** Lower the tier when a live frame test shows the device is slower than its specs suggest. Never raises. */
export function refineTier(tier: Tier, avgFrameMs: number): Tier {
  if (!Number.isFinite(avgFrameMs) || avgFrameMs <= 0) return tier;
  if (avgFrameMs > 34) return 'low';
  if (avgFrameMs > 22) return lower(tier);
  return tier;
}

const DEVICE_LABEL: Record<DeviceClass, string> = { console: 'Console', tv: 'Smart TV', phone: 'Phone', tablet: 'Tablet', laptop: 'Laptop', desktop: 'Desktop' };
const OS_LABEL: Record<OsKind, string> = { windows: 'Windows', macos: 'Mac', ios: 'iOS', android: 'Android', linux: 'Linux', xbox: 'Xbox', playstation: 'PlayStation', switch: 'Switch', tv: 'TV', other: '' };
const BROWSER_LABEL: Record<BrowserKind, string> = { edge: 'Edge', chrome: 'Chrome', firefox: 'Firefox', safari: 'Safari', samsung: 'Samsung Internet', other: 'your browser' };

export function buildProfile(f: DeviceFacts, measuredFrameMs?: number): CalibrationProfile {
  const consoleKind = detectConsole(f.ua);
  const deviceClass = classifyDevice(f);
  const browser = detectBrowser(f.ua);
  const os = detectOs(f.ua);
  const notes: CalibrationNote[] = [];
  let tier = tierOf(f, deviceClass, consoleKind);

  if (measuredFrameMs !== undefined) {
    const refined = refineTier(tier, measuredFrameMs);
    if (refined !== tier) notes.push('measured-slow');
    tier = refined;
  }
  if ((f.memoryGb ?? 8) <= 2) notes.push('low-memory');
  if (f.saveData) {
    tier = lower(tier);
    notes.push('data-saver');
  }
  if (f.batteryLevel != null && !f.charging && f.batteryLevel <= 0.2) {
    tier = lower(tier);
    notes.push('battery-low');
  }

  const cp = consoleProfile(consoleKind);
  const dprByTier: Record<Tier, number> = { low: 1, mid: 1.5, high: 2 };
  let dprCap = deviceClass === 'console' || deviceClass === 'tv' ? Math.min(cp.dprCap, dprByTier[tier]) : dprByTier[tier];
  if (deviceClass === 'console' || deviceClass === 'tv') notes.push('console-detected');
  if ((f.dpr ?? 1) > dprCap + 0.25) notes.push('hi-dpi-capped');
  dprCap = Math.max(1, dprCap);

  const fps: 30 | 60 = tier === 'low' || cp.targetFps === 30 ? 30 : 60;
  if (deviceClass === 'tv' || consoleKind === 'switch') notes.push('tv-30fps');
  if (consoleKind === 'playstation-4' || consoleKind === 'playstation-5') notes.push('old-webkit');
  if (os === 'ios') notes.push('ios-no-vibrate');
  if (f.gamepad) notes.push('gamepad-found');

  const settings: CalibrationSettings = {
    dprCap,
    fps,
    effects: tier,
    particleScale: tier === 'low' ? 0.5 : tier === 'mid' ? 0.8 : 1,
    shadows: tier !== 'low',
    inputMode: deviceClass === 'console' || deviceClass === 'tv' ? 'gamepad' : deviceClass === 'phone' || deviceClass === 'tablet' ? 'pointer' : f.gamepad ? 'gamepad' : null,
    safeInset: deviceClass === 'console' || deviceClass === 'tv' ? cp.safeInset : 0,
  };

  const label = consoleKind !== 'none' ? cp.label : `${OS_LABEL[os] ? `${OS_LABEL[os]} ` : ''}${DEVICE_LABEL[deviceClass].toLowerCase()}`.trim();
  return { deviceClass, browser, os, consoleKind, label, browserLabel: BROWSER_LABEL[browser], tier, settings, notes };
}

/** One-line summary for a prompt: "Xbox Series X|S in Edge". */
export function describeProfile(p: CalibrationProfile): string {
  return `${p.label.charAt(0).toUpperCase()}${p.label.slice(1)} in ${p.browserLabel}`;
}
