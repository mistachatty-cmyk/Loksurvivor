export type Messages = Record<string, unknown>;
export type Vars = Record<string, unknown>;

export interface L10nOptions {
  /** Locale every key is guaranteed to exist in. Default "en". */
  defaultLocale?: string;
  /** Starting locale; must already be registered in `messages`. */
  locale?: string;
  /** Locales to register up front (nested or flat). */
  messages?: Record<string, Messages>;
  /** Lazy loader, called at most once per locale. */
  loadLocale?: (locale: string) => Promise<Messages>;
  /** Locales `loadLocale` can provide, so requests resolve before they load. */
  supported?: string[];
  /** Called once per missing key, for dev warnings. */
  onMissing?: (key: string, locale: string) => void;
}

/** `K` narrows `t()` to the keys of your source file, so a typo fails typecheck. */
export class L10n<K extends string = string> {
  constructor(options?: L10nOptions);
  readonly defaultLocale: string;
  /** Increments on every locale or message change, for `useSyncExternalStore`. */
  readonly version: number;
  /** The active locale code. */
  readonly locale: string;
  knownLocales(): string[];
  register(locale: string, bundle: Messages): void;
  /** Resolves to the locale that is active afterwards; never throws. */
  setLocale(requested: string): Promise<string>;
  t(key: K, vars?: Vars): string;
  has(key: K): boolean;
  number(value: number, options?: Intl.NumberFormatOptions): string;
  date(value: Date | number, options?: Intl.DateTimeFormatOptions): string;
  subscribe(listener: () => void): () => void;
}

export function createL10n<K extends string = string>(options?: L10nOptions): L10n<K>;
export function normalizeLocale(code: string | null | undefined): string;
export function resolveLocale(requested: string | null | undefined, supported: Iterable<string>, fallback?: string): string;
export function detectLocale(options: {
  supported: Iterable<string>;
  stored?: string | null;
  languages?: readonly string[];
  fallback?: string;
}): string;
export function directionOf(locale: string): 'ltr' | 'rtl';
export function interpolate(template: string, vars?: Vars): string;
export function flatten(input: Messages, prefix?: string, out?: Record<string, string>): Record<string, string>;
export function unflatten(flat: Record<string, string>): Messages;
export function placeholdersOf(text: string): string[];
export function samePlaceholders(a: string, b: string): boolean;
