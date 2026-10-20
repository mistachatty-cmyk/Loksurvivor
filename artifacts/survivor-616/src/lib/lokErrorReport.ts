/**
 * 616 Survivor's LokErrorReport wiring: one shared reporter, its sinks (the device's crash
 * log, LOK cloud on request, and in dev the repo's docs/errors), and where the run says what
 * it was doing. The engine itself lives in `packages/lok-error-report` and knows nothing about
 * this game. See docs/LOK_ERROR_REPORT.md.
 */
import { createReporter, type ContextValue, type ErrorReport, type ReportSink } from '@lok/error-report';
import { localSink, lokFeedbackSink, repoDocsSink } from '@lok/error-report/sinks';
import { submitFeedback } from '@workspace/lok-client';

import manifest from '../../lok.universe.json';
import { prefersReducedMotion } from '@/anim/motion';
import { CURRENT_VERSION } from '@/game/data/changelog';
import { lokClient } from '@/lib/lokClient';
import { getLokErrorAutoSend, getLokErrorEnabled } from '@/lib/lokErrorReportSetting';

declare const __LOK_BUILD_ID__: string;

/** The game's own switch in `lok.universe.json`; a game opts in to the LOK crash pop-up there. */
const manifestOn = (manifest as { lokErrorReport?: { enabled?: boolean } }).lokErrorReport?.enabled !== false;

export const CRASH_LOG_KEY = 'survivor616.crashlog.v1';
export const crashLog = localSink(CRASH_LOG_KEY, 25);

/** One feedback row per crash, in the same table as the game's feedback. Undefined without a LOK client. */
const cloudClient = lokClient;
export const lokCloud = cloudClient
  ? lokFeedbackSink('616_survivor', (input) => submitFeedback(cloudClient, input))
  : undefined;

export const canSendToLok = (): boolean => Boolean(lokCloud);

export async function sendReportToLok(report: ErrorReport): Promise<void> {
  if (!lokCloud) throw new Error('LOK is not connected');
  await lokCloud.send(report);
}

const autoSend: ReportSink = {
  id: 'lok-auto',
  send: (report) => (getLokErrorAutoSend() && lokCloud ? lokCloud.send(report) : undefined),
};

const providers = new Set<() => Record<string, ContextValue>>();
let currentScreen = 'boot';

/** What the player is doing right now (hub, run...). Cheap: stored, read only at crash time. */
export function setCrashScreen(name: string): void {
  currentScreen = name;
  reporter.breadcrumb('nav', name);
}

/** Add context while something is mounted (the run reports its area and time). Returns the undo. */
export function registerCrashContext(provider: () => Record<string, ContextValue>): () => void {
  providers.add(provider);
  return () => { providers.delete(provider); };
}

export const reporter = createReporter({
  appKey: 'survivor616',
  appVersion: CURRENT_VERSION,
  buildId: typeof __LOK_BUILD_ID__ === 'string' ? __LOK_BUILD_ID__ : 'local',
  mode: import.meta.env.DEV ? 'dev' : 'prod',
  enabled: () => manifestOn && getLokErrorEnabled(),
  context: () => {
    const context: Record<string, ContextValue> = {
      screen: currentScreen,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      reducedMotion: prefersReducedMotion(),
      lang: document.documentElement.lang || 'en',
    };
    for (const provider of providers) {
      try { Object.assign(context, provider()); } catch { /* context is best-effort */ }
    }
    return context;
  },
  sinks: [crashLog, autoSend, ...(import.meta.env.DEV ? [repoDocsSink()] : [])],
});

/** Dev and e2e only: ways to make the game crash on purpose, to see what players would see. */
export function installCrashTestHooks(): void {
  if (!import.meta.env.DEV) return;
  (window as unknown as { __lokCrash: Record<string, () => void> }).__lokCrash = {
    error: () => { setTimeout(() => { throw new TypeError('LokErrorReport test: thrown in a timer on purpose'); }, 0); },
    rejection: () => { void Promise.reject(new Error('LokErrorReport test: rejected promise on purpose')); },
    render: () => { window.dispatchEvent(new Event('lok-crash-render')); },
  };
}
