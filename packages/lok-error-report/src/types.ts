/**
 * LokErrorReport shared types. Everything here is plain data so a report can be stored,
 * sent or rendered anywhere: a device log, a markdown file in a repo, a database row.
 */

/** Where an error came from. */
export type ReportKind = 'render' | 'error' | 'rejection' | 'resource' | 'manual';

/** A plain-language bucket for what went wrong (the pop-up explains each one). */
export type ErrorCategory = 'render' | 'script' | 'network' | 'storage' | 'memory' | 'resource' | 'unknown';

/** `crash` interrupts the player (pop-up or chip); `minor` is logged quietly (a missing image). */
export type Severity = 'crash' | 'minor';

export interface StackFrame {
  /** The line as the browser printed it. */
  raw: string;
  fn?: string;
  /** Path without origin or query string, e.g. `/src/ui/Hub.tsx`. */
  file?: string;
  line?: number;
  col?: number;
  /** Game/app code rather than a library, a Vite helper or the framework. */
  app: boolean;
}

export interface CodeSnippet {
  /** 1-based number of the first line in `lines`. */
  startLine: number;
  lines: string[];
  /** Index into `lines` of the failing line. */
  highlight: number;
}

/** A frame mapped back to the original source (only possible where source maps are reachable: dev). */
export interface ResolvedFrame {
  file: string;
  line: number;
  col: number;
  fn?: string;
  snippet?: CodeSnippet;
}

export interface ResolvedSource {
  frames: ResolvedFrame[];
}

export interface Breadcrumb {
  at: number;
  type: 'error' | 'nav' | 'action' | 'log';
  text: string;
}

export type ContextValue = string | number | boolean;

export interface ErrorReport {
  /** Short, stable, human-quotable (`LER-1A2B3C`). The same crash always gets the same id. */
  id: string;
  fingerprint: string;
  kind: ReportKind;
  category: ErrorCategory;
  severity: Severity;
  name: string;
  /** Redacted and length-capped. */
  message: string;
  stack: StackFrame[];
  componentStack?: string[];
  appKey: string;
  appVersion: string;
  buildId: string;
  mode: 'dev' | 'prod';
  /** First time this session. */
  at: number;
  lastAt: number;
  /** Times it happened this session. */
  count: number;
  /** Page path only, never the query string. */
  path: string;
  userAgent: string;
  context: Record<string, ContextValue>;
  breadcrumbs: Breadcrumb[];
  /** Set by the dev tooling when the original code could be located. */
  source?: ResolvedSource;
  /** What the player typed about what happened (redacted, capped). Only ever set when they chose to. */
  note?: string;
}

/** What a sink may hand back to enrich the report (the dev plugin returns `source`). */
export interface SinkResult {
  source?: ResolvedSource;
}

/**
 * Anywhere a report can be stored or sent. Keep `send` quick and never throw: the reporter
 * swallows sink failures so a broken sink can never become a second crash.
 */
export interface ReportSink {
  id: string;
  send(report: ErrorReport): Promise<SinkResult | void> | SinkResult | void;
}
