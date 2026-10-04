/**
 * @lok/auto-l10n runtime.
 *
 * A tiny, dependency-free translation manager for browser games:
 *
 *   const l10n = createL10n({ defaultLocale: 'en', messages: { en }, loadLocale });
 *   await l10n.setLocale('es-MX');          // loads es-MX, else es, else stays on en
 *   l10n.t('hud.score', { score: 120 });    // "Score: 120"
 *
 * Lookup order for every key: active locale, its base language ("pt-BR" then
 * "pt"), the default locale, and finally the key itself, so a missing
 * translation shows English instead of nothing.
 */
import { flatten } from './core.js';

export { flatten, unflatten, placeholdersOf, samePlaceholders } from './core.js';

const VARIABLE_PATTERN = /\{\{\s*([A-Za-z_][\w.]*)\s*\}\}/g;
const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi', 'dv', 'ug', 'ckb']);

/**
 * Canonical BCP 47 casing: "pt_br" becomes "pt-BR", "ZH-hant" becomes "zh-Hant".
 *
 * @param {string | null | undefined} code
 * @returns {string}
 */
export function normalizeLocale(code) {
  if (!code) return '';
  const [language, ...rest] = String(code).trim().replace(/_/g, '-').split('-');
  if (!language) return '';
  const parts = rest.map((part) => {
    if (part.length === 2) return part.toUpperCase();
    if (part.length === 4) return part[0].toUpperCase() + part.slice(1).toLowerCase();
    return part;
  });
  return [language.toLowerCase(), ...parts].join('-');
}

/**
 * Pick the best supported locale for a request: exact match, then the same
 * code with trailing subtags removed ("zh-Hant-TW" to "zh-Hant" to "zh"), then
 * any supported regional variant of the same language ("pt" matches "pt-BR").
 *
 * @param {string | null | undefined} requested
 * @param {Iterable<string>} supported
 * @param {string} [fallback]
 * @returns {string}
 */
export function resolveLocale(requested, supported, fallback = 'en') {
  const wanted = normalizeLocale(requested);
  const list = [...supported].map(normalizeLocale).filter(Boolean);
  if (!wanted) return fallback;
  const byLower = new Map(list.map((code) => [code.toLowerCase(), code]));

  const parts = wanted.split('-');
  while (parts.length > 0) {
    const hit = byLower.get(parts.join('-').toLowerCase());
    if (hit) return hit;
    parts.pop();
  }
  const language = (wanted.split('-')[0] ?? '').toLowerCase();
  const sibling = list.find((code) => code.split('-')[0]?.toLowerCase() === language);
  return sibling ?? fallback;
}

/**
 * Choose a starting locale: an explicit saved choice first (anything except
 * "auto"), then the browser's language list in order, then the fallback.
 *
 * @param {{ supported: Iterable<string>, stored?: string | null, languages?: readonly string[], fallback?: string }} options
 * @returns {string}
 */
export function detectLocale({ supported, stored, languages = [], fallback = 'en' }) {
  const list = [...supported];
  if (stored && stored !== 'auto') {
    const hit = resolveLocale(stored, list, '');
    if (hit) return hit;
  }
  for (const language of languages) {
    const hit = resolveLocale(language, list, '');
    if (hit) return hit;
  }
  return fallback;
}

/**
 * "ltr" or "rtl" for a locale, for setting `document.dir`.
 *
 * @param {string} locale
 * @returns {'ltr' | 'rtl'}
 */
export function directionOf(locale) {
  const language = normalizeLocale(locale).split('-')[0] ?? '';
  return RTL_LANGUAGES.has(language) ? 'rtl' : 'ltr';
}

/**
 * Replace `{{name}}` placeholders (dotted names read nested values). A
 * placeholder with no matching value is left as written so the gap is visible.
 *
 * @param {string} template
 * @param {Record<string, unknown> | undefined} [vars]
 * @returns {string}
 */
export function interpolate(template, vars) {
  if (!vars) return template;
  return template.replace(VARIABLE_PATTERN, (whole, name) => {
    let value = /** @type {any} */ (vars);
    for (const part of String(name).split('.')) {
      if (value === null || value === undefined) break;
      value = value[part];
    }
    return value === null || value === undefined ? whole : String(value);
  });
}

/**
 * @typedef {object} L10nOptions
 * @property {string} [defaultLocale] Locale every key is guaranteed to exist in. Default "en".
 * @property {string} [locale] Starting locale; must already be registered in `messages`.
 * @property {Record<string, Record<string, unknown>>} [messages] Locales to register up front.
 * @property {(locale: string) => Promise<Record<string, unknown>>} [loadLocale] Lazy loader, called at most once per locale.
 * @property {string[]} [supported] Locales `loadLocale` can provide, so requests resolve before they load.
 * @property {(key: string, locale: string) => void} [onMissing] Called once per missing key, for dev warnings.
 */

export class L10n {
  /** @param {L10nOptions} [options] */
  constructor(options = {}) {
    this.defaultLocale = normalizeLocale(options.defaultLocale) || 'en';
    /** @type {Map<string, Record<string, string>>} */
    this.messages = new Map();
    /** @type {Map<string, Promise<void>>} */
    this.loading = new Map();
    /** @type {Set<() => void>} */
    this.listeners = new Set();
    /** @type {Set<string>} */
    this.warned = new Set();
    /** @type {Map<string, Intl.PluralRules>} */
    this.pluralRules = new Map();
    this.supportedExtra = new Set((options.supported ?? []).map(normalizeLocale));
    this.loader = options.loadLocale;
    this.onMissing = options.onMissing;
    this.requestId = 0;
    /** Increments on every locale or message change, for `useSyncExternalStore`. */
    this.version = 0;
    this.current = this.defaultLocale;

    for (const [code, bundle] of Object.entries(options.messages ?? {})) this.register(code, bundle);
    if (options.locale) {
      const start = resolveLocale(options.locale, this.knownLocales(), this.defaultLocale);
      if (this.messages.has(start)) this.current = start;
    }
  }

  /** The active locale code. */
  get locale() {
    return this.current;
  }

  /** Every locale that is loaded or can be loaded. */
  knownLocales() {
    return [...new Set([...this.messages.keys(), ...this.supportedExtra])];
  }

  /**
   * Add messages for a locale (nested or flat). Later calls merge over earlier ones.
   *
   * @param {string} locale
   * @param {Record<string, unknown>} bundle
   */
  register(locale, bundle) {
    const code = normalizeLocale(locale);
    this.messages.set(code, { ...(this.messages.get(code) ?? {}), ...flatten(bundle) });
    this.version += 1;
    this.notify();
  }

  /**
   * Switch language. Resolves the request against known locales, loads it if
   * needed, and notifies subscribers. A failed load leaves the current locale
   * in place and never throws, so a bad network never breaks the game.
   *
   * @param {string} requested
   * @returns {Promise<string>} The locale that is now active.
   */
  async setLocale(requested) {
    const ticket = (this.requestId += 1);
    const target = resolveLocale(requested, this.knownLocales(), this.defaultLocale);
    try {
      await this.ensureLoaded(target);
    } catch (error) {
      console.warn(`[l10n] could not load "${target}":`, error);
      return this.current;
    }
    // A newer setLocale call superseded this one while it was loading.
    if (ticket !== this.requestId) return this.current;
    if (this.messages.has(target) && target !== this.current) {
      this.current = target;
      this.version += 1;
      this.notify();
    }
    return this.current;
  }

  /** @param {string} locale */
  ensureLoaded(locale) {
    if (this.messages.has(locale) || !this.loader) return Promise.resolve();
    let pending = this.loading.get(locale);
    if (!pending) {
      pending = this.loader(locale)
        .then((bundle) => {
          this.register(locale, bundle);
        })
        .finally(() => {
          this.loading.delete(locale);
        });
      this.loading.set(locale, pending);
    }
    return pending;
  }

  /**
   * Translate a key. Passing a numeric `count` picks a plural form first:
   * `key_one`, `key_other` and so on (CLDR categories for the active locale).
   *
   * @param {string} key
   * @param {Record<string, unknown>} [vars]
   * @returns {string}
   */
  t(key, vars) {
    const text = this.lookup(key, vars);
    if (text === undefined) {
      this.reportMissing(key);
      return key;
    }
    return interpolate(text, vars);
  }

  /**
   * Whether a key has any text in the active locale chain.
   *
   * @param {string} key
   */
  has(key) {
    return this.lookup(key, undefined) !== undefined;
  }

  /**
   * @param {string} key
   * @param {Record<string, unknown> | undefined} vars
   * @returns {string | undefined}
   */
  lookup(key, vars) {
    const base = this.current.split('-')[0] ?? this.current;
    const chain = [...new Set([this.current, base, this.defaultLocale])];
    const count = vars && typeof vars['count'] === 'number' ? /** @type {number} */ (vars['count']) : undefined;

    for (const locale of chain) {
      const bundle = this.messages.get(locale);
      if (!bundle) continue;
      if (count !== undefined) {
        const category = this.pluralCategory(locale, count);
        const plural = bundle[`${key}_${category}`] ?? bundle[`${key}_other`];
        if (plural !== undefined) return plural;
      }
      const plain = bundle[key];
      if (plain !== undefined) return plain;
    }
    return undefined;
  }

  /**
   * @param {string} locale
   * @param {number} count
   */
  pluralCategory(locale, count) {
    let rules = this.pluralRules.get(locale);
    if (!rules) {
      try {
        rules = new Intl.PluralRules(locale);
      } catch {
        rules = new Intl.PluralRules('en');
      }
      this.pluralRules.set(locale, rules);
    }
    return rules.select(count);
  }

  /** @param {string} key */
  reportMissing(key) {
    const id = `${this.current}\u0000${key}`;
    if (this.warned.has(id)) return;
    this.warned.add(id);
    this.onMissing?.(key, this.current);
  }

  /**
   * Format a number for the active locale.
   *
   * @param {number} value
   * @param {Intl.NumberFormatOptions} [options]
   */
  number(value, options) {
    try {
      return new Intl.NumberFormat(this.current, options).format(value);
    } catch {
      return String(value);
    }
  }

  /**
   * Format a date for the active locale.
   *
   * @param {Date | number} value
   * @param {Intl.DateTimeFormatOptions} [options]
   */
  date(value, options) {
    try {
      return new Intl.DateTimeFormat(this.current, options).format(value);
    } catch {
      return String(value);
    }
  }

  /**
   * Run `listener` after every locale or message change.
   *
   * @param {() => void} listener
   * @returns {() => void} Unsubscribe function.
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify() {
    for (const listener of [...this.listeners]) listener();
  }
}

/**
 * @param {L10nOptions} [options]
 * @returns {L10n}
 */
export function createL10n(options) {
  return new L10n(options);
}
