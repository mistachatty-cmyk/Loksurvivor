/**
 * Pure helpers shared by the runtime and the translation CLI.
 *
 * Nothing in this file touches the filesystem, the network or Node-only APIs,
 * so it is safe to import from a browser bundle.
 */

/** Placeholder syntax used in message strings: `{{playerName}}`, `{{ n }}`, `{{a.b}}`. */
export const PLACEHOLDER_PATTERN = /\{\{\s*([A-Za-z_][\w.]*)\s*\}\}/g;

/**
 * Turn a (possibly nested) messages object into a flat `{ "a.b.c": "text" }`
 * map. Only string leaves are kept. Any key that starts with an underscore
 * (for example `_comment`) is treated as metadata and skipped, at every level.
 *
 * @param {Record<string, unknown>} input
 * @param {string} [prefix]
 * @param {Record<string, string>} [out]
 * @returns {Record<string, string>}
 */
export function flatten(input, prefix = '', out = {}) {
  for (const [name, value] of Object.entries(input ?? {})) {
    if (name.startsWith('_')) continue;
    const key = prefix ? `${prefix}.${name}` : name;
    if (typeof value === 'string') {
      out[key] = value;
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(/** @type {Record<string, unknown>} */ (value), key, out);
    }
  }
  return out;
}

/**
 * True when the object contains at least one nested object, which tells the
 * CLI to write translated files in the same nested shape as the source.
 *
 * @param {Record<string, unknown>} input
 */
export function isNested(input) {
  return Object.values(input ?? {}).some((value) => value !== null && typeof value === 'object' && !Array.isArray(value));
}

/**
 * Inverse of `flatten`: `{ "a.b": "x" }` becomes `{ a: { b: "x" } }`.
 *
 * @param {Record<string, string>} flat
 * @returns {Record<string, unknown>}
 */
export function unflatten(flat) {
  /** @type {Record<string, any>} */
  const out = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let node = out;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const part = /** @type {string} */ (parts[i]);
      if (node[part] === null || typeof node[part] !== 'object') node[part] = {};
      node = node[part];
    }
    node[/** @type {string} */ (parts[parts.length - 1])] = value;
  }
  return out;
}

/**
 * Names of every `{{placeholder}}` in a string, unique and sorted.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function placeholdersOf(text) {
  const names = new Set();
  for (const match of text.matchAll(PLACEHOLDER_PATTERN)) names.add(/** @type {string} */ (match[1]));
  return [...names].sort();
}

/**
 * Whether two strings use exactly the same set of placeholders. A translation
 * that drops or renames one would print a raw `{{name}}` (or nothing) in game.
 *
 * @param {string} a
 * @param {string} b
 */
export function samePlaceholders(a, b) {
  const left = placeholdersOf(a);
  const right = placeholdersOf(b);
  return left.length === right.length && left.every((name, index) => name === right[index]);
}

const TOKEN_PATTERN = /Z\s*Q\s*(\d+)\s*Z\s*Q/gi;

/**
 * Replace everything a translator must not touch (placeholders and glossary
 * terms such as game or brand names) with opaque tokens like `ZQ0ZQ`. Machine
 * translators leave letter-and-digit tokens alone far more reliably than they
 * leave `{{braces}}` or invented nouns alone.
 *
 * @param {string} text
 * @param {string[]} [glossary] Terms to keep verbatim, matched case-sensitively.
 * @returns {{ text: string, tokens: string[] }}
 */
export function maskProtected(text, glossary = []) {
  /** @type {string[]} */
  const tokens = [];
  const take = (/** @type {string} */ original) => {
    tokens.push(original);
    return `ZQ${tokens.length - 1}ZQ`;
  };

  let masked = text.replace(PLACEHOLDER_PATTERN, (whole) => take(whole));

  // Longest terms first so "LokPets" wins over "Lok".
  const terms = [...new Set(glossary)].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Unicode-aware word edges, so "Lok" does not match inside "Lokomotive".
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'gu');
    masked = masked.replace(pattern, (whole) => take(whole));
  }
  return { text: masked, tokens };
}

/**
 * Put masked tokens back. Returns `null` when any token went missing, so the
 * caller can refuse a translation that lost a placeholder instead of shipping it.
 *
 * @param {string} translated
 * @param {string[]} tokens
 * @returns {string | null}
 */
export function unmask(translated, tokens) {
  const seen = new Set();
  const restored = translated.replace(TOKEN_PATTERN, (whole, id) => {
    const original = tokens[Number(id)];
    if (original === undefined) return whole;
    seen.add(Number(id));
    return original;
  });
  return seen.size === tokens.length ? restored : null;
}

/**
 * Whether anything is left to translate once protected tokens are removed.
 * Strings like "{{n}}" or "616" are copied across untouched.
 *
 * @param {string} maskedText
 */
export function hasTranslatableText(maskedText) {
  return /\p{L}/u.test(maskedText.replace(/ZQ\d+ZQ/g, ''));
}

/**
 * Simple `*` glob used for do-not-translate key patterns ("brand.*").
 *
 * @param {string} key
 * @param {string[]} patterns
 */
export function matchesAny(key, patterns) {
  return patterns.some((pattern) => {
    const source = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${source}$`).test(key);
  });
}
