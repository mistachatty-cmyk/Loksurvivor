/**
 * Faith Mode in Survivor 616 (ported from Queens N Kings, docs/183 there). Optional, off by default, free,
 * and never needed for anything in the game. Settings > Faith turns it on.
 *
 * The verse bar sits under the title. The bouncing Bible is an opt-in reminder that never shows during a
 * run or a minigame. The Bible reader (King James Version and World English Bible) loads one book at a
 * time from /bible and keeps no offline code cache. Progress lives in `lok.faith.v1`, the same key every
 * Lok game uses, and never touches the game save.
 */

import { syncBounce, setBounceBusyCheck, bounceNow, type BounceOpts } from './bounceRuntime';
import { EVERY_MIN, STAY_SEC } from './bounce';
import type { Religion } from './lokabiblio';
import './faith.css';

export interface FaithPrefs {
  religion: Religion;
  verseBar: boolean;
  bounce: boolean;
  everyMin: number;
  staySec: number;
  speed: 'slow' | 'normal' | 'fast';
}

export const FAITH_PREFS_KEY = 'lok.faith.settings.v1';
export const FAITH_PREFS_EVENT = 'lokfaith:prefs';
export const DEFAULT_FAITH_PREFS: FaithPrefs = { religion: 'none', verseBar: true, bounce: false, everyMin: 15, staySec: 30, speed: 'normal' };

export function normalizeFaithPrefs(raw: unknown): FaithPrefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<FaithPrefs>;
  const d = DEFAULT_FAITH_PREFS;
  return {
    religion: r.religion === 'christian' ? 'christian' : 'none',
    verseBar: typeof r.verseBar === 'boolean' ? r.verseBar : d.verseBar,
    bounce: typeof r.bounce === 'boolean' ? r.bounce : d.bounce,
    everyMin: (EVERY_MIN as readonly number[]).includes(Number(r.everyMin)) ? Number(r.everyMin) : d.everyMin,
    staySec: (STAY_SEC as readonly number[]).includes(Number(r.staySec)) ? Number(r.staySec) : d.staySec,
    speed: r.speed === 'slow' || r.speed === 'fast' || r.speed === 'normal' ? r.speed : d.speed,
  };
}

export function readFaithPrefs(): FaithPrefs {
  try {
    return normalizeFaithPrefs(JSON.parse(localStorage.getItem(FAITH_PREFS_KEY) ?? 'null'));
  } catch {
    return { ...DEFAULT_FAITH_PREFS };
  }
}

export function writeFaithPrefs(next: Partial<FaithPrefs>): FaithPrefs {
  const merged = normalizeFaithPrefs({ ...readFaithPrefs(), ...next });
  try {
    localStorage.setItem(FAITH_PREFS_KEY, JSON.stringify(merged));
  } catch {
    /* storage blocked: the choice lasts this visit */
  }
  window.dispatchEvent(new CustomEvent(FAITH_PREFS_EVENT, { detail: merged }));
  return merged;
}

export const reducedMotion = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function bounceOpts(p: FaithPrefs): BounceOpts {
  return {
    on: p.religion !== 'none' && p.bounce,
    everyMin: p.everyMin,
    staySec: p.staySec,
    speed: p.speed,
    reduced: reducedMotion(),
    stopReminders: () => writeFaithPrefs({ bounce: false }),
  };
}

/** Start following the Faith settings (bouncing reminder schedule). `busy` says when the game is being played. */
export function startFaith(busy: () => boolean): void {
  setBounceBusyCheck(busy);
  const sync = () => syncBounce(bounceOpts(readFaithPrefs()));
  window.addEventListener(FAITH_PREFS_EVENT, sync);
  window.addEventListener('storage', (e) => {
    if (e.key === FAITH_PREFS_KEY) sync();
  });
  sync();
}

export function showBounceNow(): void {
  bounceNow(bounceOpts(readFaithPrefs()));
}

export function openBible(): void {
  void import('./reader').then((m) => m.openReader('John 1:1', { reduced: reducedMotion() }));
}
