import type { ErrorCategory, ReportKind, Severity } from './types';

/** Bucket an error into something a player can understand. */
export function classify(kind: ReportKind, name: string, message: string, hasComponentStack: boolean): ErrorCategory {
  const text = `${name} ${message}`;
  if (kind === 'resource') return 'resource';
  if (/out of memory|array buffer allocation|invalid array length|allocation failed/i.test(text)) return 'memory';
  if (/quotaexceeded|storage|indexeddb|localstorage|sessionstorage/i.test(text) && /quota|storage|denied|access/i.test(text)) return 'storage';
  if (/failed to fetch|networkerror|load failed|net::err|network request|fetch|cors/i.test(text) && !/is not a function|undefined|null/i.test(text)) return 'network';
  if (kind === 'render' || hasComponentStack) return 'render';
  if (!name || name === 'Error' && !message) return 'unknown';
  return 'script';
}

const BENIGN = [/ResizeObserver loop/i, /^Script error\.?$/i, /ResizeObserver loop completed/i];

/** Messages browsers raise that are not crashes and would only cry wolf. */
export function isBenign(message: string): boolean {
  return BENIGN.some((pattern) => pattern.test(message));
}

export function severityOf(kind: ReportKind): Severity {
  return kind === 'resource' ? 'minor' : 'crash';
}
