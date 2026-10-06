/**
 * The hand-off from the overlay to the GSix hub's report page.
 *
 * A finished run is encoded into the URL FRAGMENT (`#r=...`), which browsers
 * never send to a server. It carries only the run's own numbers -- never the
 * page's address, text or any screenshot. The hub page decodes and validates it
 * independently (`apps/hub/lib/demoday-report.ts`); keep the two in step.
 */
export const REPORT_URL = 'https://gsix.online/games/demoday/report';

export interface ReportSummary {
  destroyedPct: number;
  kills: number;
  level: number;
  elapsedSec: number;
}

export interface ReportPayload {
  v: 1;
  /** Page destroyed, 0..100. */
  pct: number;
  kills: number;
  level: number;
  /** Run length in seconds. */
  sec: number;
  /** Character id the run used. */
  ch: string;
}

const toInt = (n: number, max: number) => Math.max(0, Math.min(max, Math.round(Number.isFinite(n) ? n : 0)));

export function reportPayload(summary: ReportSummary, character = 'foreman'): ReportPayload {
  return {
    v: 1,
    pct: toInt(summary.destroyedPct, 100),
    kills: toInt(summary.kills, 1_000_000),
    level: toInt(summary.level, 999),
    sec: toInt(summary.elapsedSec, 86_400),
    ch: character,
  };
}

/** base64url of the JSON (all ASCII, so plain btoa is safe). */
export function encodeReport(summary: ReportSummary, character = 'foreman'): string {
  return btoa(JSON.stringify(reportPayload(summary, character)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function reportUrl(summary: ReportSummary, character = 'foreman'): string {
  return `${REPORT_URL}#r=${encodeReport(summary, character)}`;
}
