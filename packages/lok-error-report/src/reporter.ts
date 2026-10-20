import { Breadcrumbs } from './breadcrumbs';
import { classify, isBenign, severityOf } from './classify';
import { fingerprintOf, reportIdOf } from './fingerprint';
import { redact } from './redact';
import { isAppFile, normalizeFile, parseComponentStack, parseStack } from './stack';
import type { ContextValue, ErrorReport, ReportKind, ReportSink } from './types';

export interface ReporterConfig {
  appKey: string;
  appVersion: string;
  buildId?: string;
  /** `dev` is allowed to show exact code locations; `prod` never does. */
  mode: 'dev' | 'prod';
  /** The on/off switch (manifest flag AND the player's setting). Off means nothing is captured, stored or sent. */
  enabled: () => boolean;
  /** Small facts about where the player was (screen, level). Called at crash time only. */
  context?: () => Record<string, ContextValue>;
  /** Sinks that run for every new crash. Sending to the cloud is deliberately not one of them by default. */
  sinks?: ReportSink[];
  /** New crashes per minute before the rest are dropped (a render loop must not flood anything). */
  maxPerMinute?: number;
  now?: () => number;
  path?: () => string;
  userAgent?: () => string;
  isAppFile?: (file: string | undefined) => boolean;
}

export interface ReportInput {
  error: unknown;
  kind: ReportKind;
  /** React's component stack, when there is one. */
  componentStack?: string | null;
  extra?: Record<string, ContextValue>;
}

export interface ReporterEvent {
  report: ErrorReport;
  /** First time this crash was seen this session. */
  fresh: boolean;
}

export interface Reporter {
  readonly config: ReporterConfig;
  report(input: ReportInput): ErrorReport | null;
  breadcrumb(type: 'nav' | 'action' | 'log', text: string): void;
  subscribe(listener: (event: ReporterEvent) => void): () => void;
  /** This session's crashes, newest first. */
  getReports(): ErrorReport[];
  latest(): ErrorReport | undefined;
  /** Hook `window` errors and rejections (and breadcrumb console errors). Returns the undo. */
  install(target?: Window): () => void;
}

interface NormalizedError { name: string; message: string; stack?: string }

function normalizeError(value: unknown): NormalizedError {
  if (value instanceof Error) return { name: value.name || 'Error', message: value.message, stack: value.stack };
  if (typeof value === 'string') return { name: 'Error', message: value };
  try {
    const text = JSON.stringify(value);
    return { name: 'NonError', message: text === undefined ? String(value) : text };
  } catch {
    return { name: 'NonError', message: String(value) };
  }
}

const trimTo = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export function createReporter(config: ReporterConfig): Reporter {
  const now = config.now ?? (() => Date.now());
  const appFile = config.isAppFile ?? isAppFile;
  const maxPerMinute = config.maxPerMinute ?? 6;
  const crumbs = new Breadcrumbs();
  const byFingerprint = new Map<string, ErrorReport>();
  const ordered: ErrorReport[] = [];
  const freshTimes: number[] = [];
  const listeners = new Set<(event: ReporterEvent) => void>();

  const emit = (event: ReporterEvent) => { for (const listener of listeners) { try { listener(event); } catch { /* a listener must never crash the reporter */ } } };

  const runSinks = (report: ErrorReport) => {
    for (const sink of config.sinks ?? []) {
      try {
        Promise.resolve(sink.send(report)).then((result) => {
          if (result && result.source) {
            report.source = result.source;
            emit({ report, fresh: false });
          }
        }, () => { /* a failing sink is not a crash */ });
      } catch { /* same */ }
    }
  };

  const report: Reporter['report'] = (input) => {
    if (!config.enabled()) return null;
    const err = normalizeError(input.error);
    if (isBenign(err.message)) return null;
    const at = now();
    const frames = parseStack(err.stack, appFile);
    const message = redact(err.message, 500);
    const fingerprint = fingerprintOf(err.name, message, frames);

    const existing = byFingerprint.get(fingerprint);
    if (existing) {
      existing.count += 1;
      existing.lastAt = at;
      // Keep sinks' counts roughly current without sending on every repeat.
      if ((existing.count & (existing.count - 1)) === 0) runSinks(existing);
      emit({ report: existing, fresh: false });
      return existing;
    }

    while (freshTimes.length > 0 && at - freshTimes[0]! > 60_000) freshTimes.shift();
    if (freshTimes.length >= maxPerMinute) return null;
    freshTimes.push(at);

    const componentStack = parseComponentStack(input.componentStack);
    let context: Record<string, ContextValue> = {};
    try { context = { ...(config.context?.() ?? {}), ...(input.extra ?? {}) }; } catch { /* context is best-effort */ }
    for (const [key, value] of Object.entries(context)) if (typeof value === 'string') context[key] = redact(value, 120);

    const created: ErrorReport = {
      id: reportIdOf(fingerprint),
      fingerprint,
      kind: input.kind,
      category: classify(input.kind, err.name, message, componentStack.length > 0),
      severity: severityOf(input.kind),
      name: trimTo(err.name, 60),
      message,
      stack: frames.map((f) => ({ ...f, raw: redact(f.raw, 300) })),
      componentStack: componentStack.length > 0 ? componentStack : undefined,
      appKey: config.appKey,
      appVersion: config.appVersion,
      buildId: config.buildId ?? 'unknown',
      mode: config.mode,
      at,
      lastAt: at,
      count: 1,
      path: normalizeFile(config.path?.() ?? (typeof location !== 'undefined' ? location.pathname : '/')),
      userAgent: trimTo(config.userAgent?.() ?? (typeof navigator !== 'undefined' ? navigator.userAgent : ''), 140),
      context,
      breadcrumbs: crumbs.snapshot(),
    };
    byFingerprint.set(fingerprint, created);
    ordered.unshift(created);
    if (ordered.length > 50) ordered.pop();
    crumbs.add('error', `${created.name}: ${created.message}`, at);
    runSinks(created);
    emit({ report: created, fresh: true });
    return created;
  };

  const install: Reporter['install'] = (target) => {
    const win = target ?? (typeof window !== 'undefined' ? window : undefined);
    if (!win) return () => {};
    const onError = (event: ErrorEvent) => {
      const el = event.target;
      if (el && typeof (el as Element).tagName === 'string' && el !== (win as unknown)) {
        const tag = (el as Element).tagName.toLowerCase();
        const src = (el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src || (el as HTMLLinkElement).href || '';
        report({ error: new Error(`Failed to load <${tag}> ${normalizeFile(src)}`), kind: 'resource' });
        return;
      }
      if (event.error !== undefined && event.error !== null) {
        report({ error: event.error, kind: 'error' });
        return;
      }
      const where = event.filename ? `\n    at <anonymous> (${event.filename}:${event.lineno || 0}:${event.colno || 0})` : '';
      const synthetic = new Error(event.message || 'Unknown error');
      synthetic.stack = `Error: ${synthetic.message}${where}`;
      report({ error: synthetic, kind: 'error' });
    };
    const onRejection = (event: PromiseRejectionEvent) => report({ error: event.reason, kind: 'rejection' });
    win.addEventListener('error', onError, true);
    win.addEventListener('unhandledrejection', onRejection, true);

    const con: Console | undefined = (win as unknown as { console?: Console }).console;
    const original = con?.error;
    if (con && typeof original === 'function') {
      con.error = (...args: unknown[]) => {
        try { crumbs.add('log', args.map((a) => (typeof a === 'string' ? a : a instanceof Error ? a.message : '[object]')).join(' '), now()); } catch { /* never break logging */ }
        return original.apply(con, args as []);
      };
    }
    return () => {
      win.removeEventListener('error', onError, true);
      win.removeEventListener('unhandledrejection', onRejection, true);
      if (con && original) con.error = original;
    };
  };

  return {
    config,
    report,
    breadcrumb: (type, text) => crumbs.add(type, text, now()),
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getReports: () => [...ordered],
    latest: () => ordered[0],
    install,
  };
}
