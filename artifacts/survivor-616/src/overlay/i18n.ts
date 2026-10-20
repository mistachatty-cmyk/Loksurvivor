/**
 * Localization for the overlay bundle. Same files as the game (`src/locales/*.json`, English is the source and
 * the other languages are filled in by the Auto-translate action), but loaded eagerly: the overlay is one
 * self-contained script and has no lazy chunks. The language follows the browser's language list; a string with
 * no translation yet falls back to English one by one. Browser-only (it uses `import.meta.glob`).
 */
import { createL10n, detectLocale, normalizeLocale } from '@lok/auto-l10n';

import en from '@/locales/en.json';

export type OverlayKey = Extract<keyof typeof en, `overlay.${string}`>;

type Messages = Record<string, string>;

const files = import.meta.glob<Messages>('../locales/*.json', { eager: true, import: 'default' });
const FILE_CODE = /\/([A-Za-z0-9-]+)\.json$/;

const messages: Record<string, Messages> = { en };
for (const [path, bundle] of Object.entries(files)) {
  const code = FILE_CODE.exec(path)?.[1];
  if (code && normalizeLocale(code) !== 'en') messages[normalizeLocale(code)] = bundle;
}

const supported = Object.keys(messages);
let l10n = build(typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]);

function build(languages: readonly string[]) {
  const locale = detectLocale({ supported, languages: languages.filter(Boolean), fallback: 'en' });
  return createL10n<OverlayKey>({ defaultLocale: 'en', locale, messages, supported });
}

/** Re-detect from the browser's current language list (called at the start of every run). */
export function refreshLocale(languages: readonly string[]): void {
  l10n = build(languages);
}

export function t(key: OverlayKey, vars?: Record<string, unknown>): string {
  return l10n.t(key, vars);
}

export function currentLocale(): string {
  return l10n.locale;
}
