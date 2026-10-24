/**
 * Battery saver. One switch that trims the things which cost the most power: the run's frame
 * rate, the music-reactive glow and disc effects, the Jukebox Room's wake lock, and the ambient
 * background animations. It never changes what happens in the game: the simulation stays
 * fixed-step and rewards are untouched.
 *
 * Modes: Off, On, or Auto (default). Auto turns itself on when the device reports a low battery
 * that is not charging, or when the browser's Data Saver is on. Browsers without a battery
 * reading (Safari) simply never trigger the battery reason.
 */
import { useSyncExternalStore } from 'react';

import { createPref } from './devicePref';

export type SaverMode = 'off' | 'auto' | 'on';
export type SaverReason = 'manual' | 'battery' | 'dataSaver';
export const SAVER_CAPS = [30, 45, 60] as const;
export type SaverCap = (typeof SAVER_CAPS)[number];
/** Auto mode starts saving at or below this battery level while not charging. */
export const LOW_BATTERY = 0.2;

export interface PowerFacts {
  /** 0 to 1, or null when the browser gives no reading. */
  batteryLevel: number | null;
  charging: boolean;
  saveData: boolean;
}

export const saverModePref = createPref<SaverMode>('survivor616.power.saver.v1', 'auto', (raw): raw is SaverMode => raw === 'off' || raw === 'auto' || raw === 'on');
export const saverCapPref = createPref<string>('survivor616.power.saver-fps.v1', '30', (raw): raw is string => raw === '30' || raw === '45' || raw === '60');
/** Lock-screen and earbud controls. Costs nothing but is a service the player may not want. */
export const mediaControlsPref = createPref<boolean>('survivor616.audio.media-controls.v1', true);
/** Counting active play time toward the player's GSix account (or the anonymous tally). */
export const playtimeSharingPref = createPref<boolean>('survivor616.net.playtime.v1', true);

export function savingReason(mode: SaverMode, facts: PowerFacts): SaverReason | null {
  if (mode === 'off') return null;
  if (mode === 'on') return 'manual';
  if (facts.batteryLevel !== null && !facts.charging && facts.batteryLevel <= LOW_BATTERY) return 'battery';
  if (facts.saveData) return 'dataSaver';
  return null;
}

/** The frame rate a run may use: the player's choice, held down to the saver's cap while saving. */
export function effectiveFrameRate(requested: 30 | 60 | 120, saving: boolean, cap: number): number {
  return saving ? Math.min(requested, cap) : requested;
}

export function capValue(): SaverCap {
  const n = Number(saverCapPref.get());
  return n === 45 || n === 60 ? n : 30;
}

// ---- live facts ---------------------------------------------------------------------------

interface BatteryLike extends EventTarget {
  level: number;
  charging: boolean;
}

let facts: PowerFacts = { batteryLevel: null, charging: true, saveData: false };
let watching = false;
const listeners = new Set<() => void>();
let snapshot = compute();

function compute() {
  const mode = saverModePref.get();
  const reason = savingReason(mode, facts);
  return { mode, reason, saving: reason !== null, facts, cap: capValue() };
}

export type PowerStatus = ReturnType<typeof compute>;

function refresh() {
  const next = compute();
  const same = next.mode === snapshot.mode && next.reason === snapshot.reason && next.cap === snapshot.cap
    && next.facts === snapshot.facts;
  if (same) return;
  snapshot = next;
  if (typeof document !== 'undefined') {
    if (next.saving) document.documentElement.setAttribute('data-power-save', '');
    else document.documentElement.removeAttribute('data-power-save');
  }
  listeners.forEach((l) => l());
}

function setFacts(patch: Partial<PowerFacts>) {
  facts = { ...facts, ...patch };
  refresh();
}

/** Starts following the battery and Data Saver. Safe to call more than once. */
export function startPowerWatch(): void {
  if (watching || typeof navigator === 'undefined') return;
  watching = true;
  saverModePref.subscribe(refresh);
  saverCapPref.subscribe(refresh);

  const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
  if (connection) {
    setFacts({ saveData: connection.saveData === true });
    connection.addEventListener?.('change', () => setFacts({ saveData: connection.saveData === true }));
  }
  const getBattery = (navigator as Navigator & { getBattery?: () => Promise<BatteryLike> }).getBattery;
  if (typeof getBattery === 'function') {
    getBattery.call(navigator).then(
      (battery) => {
        const read = () => setFacts({ batteryLevel: battery.level, charging: battery.charging });
        read();
        battery.addEventListener('levelchange', read);
        battery.addEventListener('chargingchange', read);
      },
      () => {
        /* no battery reading: the battery reason never applies */
      },
    );
  }
  refresh();
}

const subscribe = (listener: () => void) => {
  startPowerWatch();
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Everything about the saver for the Settings screen. */
export function usePowerStatus(): PowerStatus {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

/** True while the battery saver is on (manually or by Auto). */
export function useSavingPower(): boolean {
  return useSyncExternalStore(subscribe, () => snapshot.saving, () => false);
}

/** Non-React read, for code that runs inside the game loop. */
export function isSavingPower(): boolean {
  return snapshot.saving;
}
