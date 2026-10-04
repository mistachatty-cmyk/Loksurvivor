/**
 * Game-side localization, built on `@lok/auto-l10n`.
 *
 * - English (`src/locales/en.json`) is the source of truth and is bundled, so
 *   the first paint never waits on a network request.
 * - Every other `src/locales/<code>.json` is lazy-loaded on demand. Those files
 *   are produced by the Auto-translate GitHub Action (see
 *   `.github/workflows/auto-l10n.yml`); nobody edits them for new text.
 * - `t('some.key')` is typed against `en.json`, so a misspelled key fails
 *   `pnpm typecheck` instead of showing a raw key in game.
 * - The language choice is device-local and defaults to "auto": the game follows
 *   the browser or phone language list (`navigator.languages`) and switches live
 *   if the device language changes. Picking a language in Settings pins it.
 *   Strings with no translation yet fall back to English one by one.
 *
 * Adding text: add the key to `en.json`, use `t('key')` or `useT()`. Never edit
 * another language file for a new string; the Action fills it in after you push.
 */
import { useSyncExternalStore } from 'react';
import { createL10n, detectLocale, normalizeLocale, resolveLocale } from '@lok/auto-l10n';

import en from '@/locales/en.json';

export type MessageKey = keyof typeof en;

type Messages = Record<string, string>;

const LANGUAGE_KEY = 'survivor616.lang';
export const AUTO_LANGUAGE = 'auto';

// Dotfiles such as `.l10n-lock.json` are skipped by the glob and by the pattern below.
const localeFiles = import.meta.glob<Messages>('../locales/*.json', { import: 'default' });
const FILE_CODE = /\/([A-Za-z0-9-]+)\.json$/;

const loaders = new Map<string, () => Promise<Messages>>();
for (const [path, load] of Object.entries(localeFiles)) {
  const code = FILE_CODE.exec(path)?.[1];
  if (code && normalizeLocale(code) !== 'en') loaders.set(normalizeLocale(code), load);
}

/** English plus every language file that has been generated so far. */
export const AVAILABLE_LOCALES: readonly string[] = ['en', ...[...loaders.keys()].sort()];

export const l10n = createL10n<MessageKey>({
  defaultLocale: 'en',
  messages: { en },
  supported: [...AVAILABLE_LOCALES],
  loadLocale: (code) => {
    const load = loaders.get(code);
    return load ? load() : Promise.reject(new Error(`No locale file for "${code}"`));
  },
  onMissing: (key, locale) => {
    if (import.meta.env.DEV) console.warn(`[l10n] ${locale}: no text for "${key}"`);
  },
});

/** Translate outside React (engine callbacks, toasts). Inside components use `useT()`. */
export function t(key: MessageKey, vars?: Record<string, unknown>): string {
  return l10n.t(key, vars);
}

/**
 * Subscribe a component to language changes and get `t`. The hook is what makes
 * the screen redraw when the language switches or its file finishes loading.
 */
export function useT(): typeof t {
  useSyncExternalStore(subscribe, getVersion);
  return t;
}

/** The active locale code, re-rendering on change. */
export function useLocale(): string {
  return useSyncExternalStore(subscribe, getLocale);
}

function subscribe(listener: () => void): () => void {
  return l10n.subscribe(listener);
}
function getVersion(): number {
  return l10n.version;
}
function getLocale(): string {
  return l10n.locale;
}

/** The saved choice: `"auto"` or a locale code. Defaults to automatic. */
export function getLanguagePreference(): string {
  try {
    return window.localStorage.getItem(LANGUAGE_KEY) ?? AUTO_LANGUAGE;
  } catch {
    return AUTO_LANGUAGE;
  }
}

function deviceLanguages(): readonly string[] {
  const list = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
  return list.filter(Boolean);
}

/** The supported language that "automatic" picks on this device right now. */
export function detectDeviceLanguage(): string {
  return detectLocale({ supported: AVAILABLE_LOCALES, languages: deviceLanguages(), fallback: 'en' });
}

function targetFor(preference: string): string {
  if (preference === AUTO_LANGUAGE) return detectDeviceLanguage();
  return resolveLocale(preference, AVAILABLE_LOCALES, 'en');
}

function reflectOnDocument(): void {
  document.documentElement.lang = l10n.locale;
}

/** Save the choice and switch to it. Resolves once the language is active. */
export async function setLanguagePreference(preference: string): Promise<void> {
  try {
    window.localStorage.setItem(LANGUAGE_KEY, preference);
  } catch {
    // Storage unavailable: the choice lasts until reload.
  }
  await l10n.setLocale(targetFor(preference));
  reflectOnDocument();
}

/**
 * Apply the saved language. Call once before the first render, so a returning
 * player in another language never sees a flash of English.
 */
export async function initLocalization(): Promise<void> {
  await l10n.setLocale(targetFor(getLanguagePreference()));
  reflectOnDocument();
  followDeviceLanguage();
}

let following = false;

/** While the choice is automatic, track the device: the browser fires this when its language list changes. */
function followDeviceLanguage(): void {
  if (following || typeof window === 'undefined') return;
  following = true;
  window.addEventListener('languagechange', () => {
    if (getLanguagePreference() !== AUTO_LANGUAGE) return;
    void l10n.setLocale(detectDeviceLanguage()).then(reflectOnDocument);
  });
}

/** A language's name written in that language, e.g. "Español" for `es`. */
export function languageName(code: string): string {
  try {
    const name = new Intl.DisplayNames([code], { type: 'language' }).of(code);
    if (name) return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
  } catch {
    // Unknown or malformed code: fall through to the code itself.
  }
  return code;
}
