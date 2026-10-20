import { toFeedbackMessage } from './format';
import type { ErrorReport, ReportSink, SinkResult } from './types';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): StorageLike | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

/** The device's own crash log: the newest `max` reports, newest first. Always safe to call. */
export interface LocalLog extends ReportSink {
  list(): ErrorReport[];
  clear(): void;
}

export function localSink(key: string, max = 25, storage: StorageLike | null = defaultStorage()): LocalLog {
  const read = (): ErrorReport[] => {
    try {
      const raw = storage?.getItem(key);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as ErrorReport[]).filter((r) => r && typeof r.fingerprint === 'string') : [];
    } catch {
      return [];
    }
  };
  return {
    id: 'local',
    list: read,
    clear: () => { try { storage?.removeItem(key); } catch { /* nothing to clear */ } },
    send(report) {
      try {
        const rest = read().filter((r) => r.fingerprint !== report.fingerprint);
        // Source snippets are large and dev-only; the device log keeps the lean report.
        const lean: ErrorReport = { ...report, source: undefined };
        storage?.setItem(key, JSON.stringify([lean, ...rest].slice(0, max)));
      } catch { /* storage full or blocked: the log is best-effort */ }
    },
  };
}

export function callbackSink(id: string, fn: (report: ErrorReport) => void): ReportSink {
  return { id, send: (report) => { fn(report); } };
}

type FetchLike = (input: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; json?: () => Promise<unknown> }>;

/** POST the report as JSON to any URL you own (a log service, a function, a relay). */
export function webhookSink(url: string, opts: { headers?: Record<string, string>; fetchImpl?: FetchLike } = {}): ReportSink {
  const doFetch: FetchLike | undefined = opts.fetchImpl ?? (typeof fetch === 'function' ? (fetch.bind(globalThis) as unknown as FetchLike) : undefined);
  return {
    id: 'webhook',
    async send(report) {
      if (!doFetch) return;
      await doFetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(opts.headers ?? {}) }, body: JSON.stringify({ report: { ...report, source: undefined } }) });
    },
  };
}

export interface FeedbackSubmit {
  (input: { source: string; message: string; category: 'bug' }): PromiseLike<{ error?: { message: string } | null }>;
}

/**
 * LOK cloud: one feedback row per crash, in the same table the game's feedback uses. Pass the
 * game's own `submitFeedback` (bound to its client) so this package needs no database library.
 * Not an automatic sink: call `send` when the player chooses Send.
 */
export function lokFeedbackSink(source: string, submit: FeedbackSubmit): ReportSink & { sent(report: ErrorReport): boolean } {
  const sentFingerprints = new Set<string>();
  return {
    id: 'lok-feedback',
    sent: (report) => sentFingerprints.has(report.fingerprint),
    async send(report) {
      if (sentFingerprints.has(report.fingerprint)) return;
      const { error } = await submit({ source, category: 'bug', message: toFeedbackMessage(report) });
      if (error) throw new Error(error.message);
      sentFingerprints.add(report.fingerprint);
    },
  };
}

export const REPO_DOCS_ENDPOINT = '/__lok/error-report';
export const REPO_DOCS_HEADER = 'x-lok-error-report';

/**
 * Dev only: hand the crash to the dev server (`lokErrorReportPlugin`), which writes
 * `docs/errors/<fingerprint>.md` and answers with the original code location.
 */
export function repoDocsSink(opts: { endpoint?: string; fetchImpl?: FetchLike } = {}): ReportSink {
  const endpoint = opts.endpoint ?? REPO_DOCS_ENDPOINT;
  const doFetch: FetchLike | undefined = opts.fetchImpl ?? (typeof fetch === 'function' ? (fetch.bind(globalThis) as unknown as FetchLike) : undefined);
  return {
    id: 'repo-docs',
    async send(report): Promise<SinkResult | void> {
      if (!doFetch) return;
      const response = await doFetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', [REPO_DOCS_HEADER]: '1' }, body: JSON.stringify({ report }) });
      if (!response.ok || !response.json) return;
      const data = (await response.json()) as { source?: SinkResult['source'] };
      return data && data.source ? { source: data.source } : undefined;
    },
  };
}

