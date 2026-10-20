/**
 * Scrub anything that should not leave the device from text bound for a report: emails,
 * tokens and keys, long opaque strings and URL query strings. Conservative on purpose:
 * a report that loses a detail is better than one that leaks a secret.
 */

const RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\b/g, '[token]'],
  [/\b(?:sb|sbp|sk|pk|ghp|gho|ghs|github_pat|xox[a-z])[-_][A-Za-z0-9_-]{16,}\b/g, '[key]'],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, 'Bearer [token]'],
  [/\b(api[_-]?key|apikey|token|secret|password|passwd|auth)(["']?\s*[:=]\s*["']?)[^\s"'&,;)]{4,}/gi, '$1$2[redacted]'],
  [/(https?:\/\/[^\s?#"'<>)]+)\?[^\s"'<>)]*/g, '$1?[query]'],
  [/\b[A-Za-z0-9+/_-]{40,}={0,2}(?![A-Za-z0-9+/_-])/g, '[opaque]'],
];

export function redact(text: string, maxLength = 600): string {
  let out = text;
  for (const [pattern, replacement] of RULES) out = out.replace(pattern, replacement);
  return out.length > maxLength ? `${out.slice(0, maxLength - 1)}…` : out;
}
