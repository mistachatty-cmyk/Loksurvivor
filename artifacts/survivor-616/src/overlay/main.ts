/**
 * IIFE entry for the page overlay bundle. Exposes `window.Survivor616DemoDay`
 * and, when loaded with `data-autostart` (the bookmarklet and the LOK button
 * both do this), starts immediately. Loading it a second time on the same
 * page toggles the run off, so clicking the bookmarklet twice is a clean exit.
 */
import { DemoDaySession, type RunSummary, type StartResult } from './session';

interface DemoDayApi {
  start(): StartResult;
  stop(restore?: boolean): RunSummary | null;
  toggle(): StartResult | RunSummary | null;
  isRunning(): boolean;
}

declare global {
  interface Window {
    Survivor616DemoDay?: DemoDayApi;
  }
}

function install(): DemoDayApi {
  if (window.Survivor616DemoDay) return window.Survivor616DemoDay;
  const session = new DemoDaySession(window);
  const api: DemoDayApi = {
    start: () => session.start(),
    stop: (restore = true) => session.stop(restore),
    toggle: () => (session.isRunning ? session.stop(true) : session.start()),
    isRunning: () => session.isRunning,
  };
  window.Survivor616DemoDay = api;
  return api;
}

const existing = window.Survivor616DemoDay;
const api = install();
const script = document.currentScript;
const autostart = script instanceof HTMLScriptElement && script.dataset.autostart !== undefined;
if (autostart) {
  // A second load of an already-installed bundle is the "click again to exit" case.
  if (existing) api.toggle();
  else api.start();
}
