// Schedules the bouncing Bible reminder (docs/183). Opt-in. Waits for calm moments: never during a battle, never while the tab is hidden.
import { EVERY_MIN, STAY_SEC, pickBounceVerse, showBounce, type BounceCtl } from './bounce';
import { loadFaith, recordBounce } from './faithStore';
import { BOOKS } from './lokabiblio';
import { openCard } from './verseBar';

/** The game says when a reminder would get in the way (a run or a minigame is being played). */
let isGameBusy: () => boolean = () => false;
export function setBounceBusyCheck(fn: () => boolean): void { isGameBusy = fn; }

export interface BounceOpts { on: boolean; everyMin: number; staySec: number; speed: 'slow' | 'normal' | 'fast'; reduced: boolean; stopReminders(): void }
/** Milliseconds until the next reminder; retries soon when the moment is busy. Pure. */
export function nextDelay(everyMin: number, busy: boolean): number {
  const m = (EVERY_MIN as readonly number[]).includes(everyMin) ? everyMin : 15;
  return busy ? 60_000 : m * 60_000;
}
export const clampStay = (s: number): number => ((STAY_SEC as readonly number[]).includes(s) ? s : 30);

let timer = 0, ctl: BounceCtl | null = null, cur: BounceOpts | null = null;
const busy = (): boolean => document.hidden || isGameBusy() || !!document.querySelector('.fv-back, .fr-back, .fb-book');
function schedule(ms: number): void {
  clearTimeout(timer);
  timer = window.setTimeout(() => { if (!cur?.on) return; if (busy()) return schedule(nextDelay(cur.everyMin, true)); fire(); }, ms);
}
function fire(force = false): void {
  const o = cur; if (!o || (!o.on && !force)) return;
  const verse = pickBounceVerse(Math.random() < 0.4 ? 'saved' : 'random', Math.random(), loadFaith().marks, undefined, [...BOOKS]);
  if (!verse) return schedule(nextDelay(o.everyMin, false));
  ctl = showBounce({ verse, speed: o.speed, staySec: clampStay(o.staySec), reduced: o.reduced,
    onEnd: () => { ctl = null; if (cur?.on) schedule(nextDelay(cur.everyMin, false)); },
    onTap: (v, c) => { recordBounce(); openCard(v, o.reduced, [
      { label: 'Remind me later', run: () => c.stop() },
      { label: 'Stop reminders', run: () => { c.stop(); o.stopReminders(); } },
    ], () => { if (c.el.isConnected) c.pause(false); }); } });
}
/** Call whenever settings change. Starts, restarts or stops the schedule. */
export function syncBounce(o: BounceOpts): void {
  const was = cur; cur = o;
  if (!o.on) { clearTimeout(timer); ctl?.stop(); return; }
  if (!was?.on || was.everyMin !== o.everyMin) schedule(nextDelay(o.everyMin, false));
}
/** For the Settings "Show it now" button. */
export function bounceNow(o: BounceOpts): void { if (!cur) cur = { ...o, on: false }; if (!document.querySelector('.fb-book')) fire(true); }
