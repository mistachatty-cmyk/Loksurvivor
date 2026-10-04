/**
 * Incremental translation of one locale against the source locale.
 *
 * State lives in two places next to the locale files:
 *   - the target file itself (`es.json`), edited freely by humans
 *   - `.l10n-lock.json`, which records, per language and key, a hash of the
 *     English text each translation was made from
 *
 * A key is (re)translated when it is missing from the target, or when its
 * English text changed since the translation was made. A hand-written
 * translation with no lock entry is adopted as-is, never overwritten.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  flatten,
  hasTranslatableText,
  isNested,
  matchesAny,
  maskProtected,
  samePlaceholders,
  unflatten,
  unmask,
} from './core.js';

export const LOCK_FILE = '.l10n-lock.json';

/** @param {string} text */
export function hashText(text) {
  return createHash('sha1').update(text).digest('hex').slice(0, 12);
}

/**
 * @param {string} file
 * @param {any} fallback
 */
export async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') return fallback;
    throw new Error(`Could not read ${file}: ${/** @type {Error} */ (error).message}`);
  }
}

/**
 * @param {string} file
 * @param {unknown} data
 */
export async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await fs.rename(temp, file);
}

/**
 * Work out what a sync would do, without touching the network.
 *
 * @param {object} input
 * @param {Record<string, string>} input.source Flat source strings.
 * @param {Record<string, string>} input.target Flat existing translations.
 * @param {Record<string, string>} input.lock Key to source hash, for this language.
 * @param {boolean} [input.force] Retranslate everything.
 * @param {string[]} [input.keep] Key patterns copied verbatim, never translated.
 */
export function planSync({ source, target, lock, force = false, keep = [] }) {
  /** @type {string[]} */ const missing = [];
  /** @type {string[]} */ const stale = [];
  /** @type {string[]} */ const adopt = [];
  /** @type {string[]} */ const copy = [];
  /** @type {string[]} */ const broken = [];
  /** @type {string[]} */ const orphans = Object.keys(target).filter((key) => !(key in source));
  let upToDate = 0;

  for (const [key, text] of Object.entries(source)) {
    if (matchesAny(key, keep)) {
      if (target[key] !== text) copy.push(key);
      continue;
    }
    const existing = target[key];
    if (existing === undefined || existing === '') {
      missing.push(key);
    } else if (force) {
      stale.push(key);
    } else if (lock[key] === undefined) {
      // A translation nobody recorded: trust it, but remember its source.
      adopt.push(key);
    } else if (lock[key] !== hashText(text)) {
      stale.push(key);
    } else {
      upToDate += 1;
    }
    if (existing !== undefined && existing !== '' && !samePlaceholders(text, existing)) broken.push(key);
  }

  return { missing, stale, adopt, copy, broken, orphans, upToDate, todo: [...missing, ...stale] };
}

/** @param {unknown} error */
export function isRateLimit(error) {
  const e = /** @type {any} */ (error);
  return Boolean(e && (e.name === 'TooManyRequestsError' || e.statusCode === 429 || e.status === 429 || /\b429\b|too many requests/i.test(String(e.message))));
}

/**
 * Rate limits and flaky networks are worth waiting out; an unsupported
 * language or a malformed request is not.
 *
 * @param {unknown} error
 */
function isTransient(error) {
  const e = /** @type {any} */ (error);
  return isRateLimit(error) || /ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|fetch failed|network|timeout|\b5\d\d\b/i.test(`${e?.code ?? ''} ${e?.message ?? ''}`);
}

/** @param {number} ms */
const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run an engine call, waiting out rate limits and flaky networks with
 * exponential backoff. Anything else (an unsupported language, a malformed
 * request) fails at once.
 *
 * @template T
 * @param {() => Promise<T>} call
 * @param {{ retries: number, retryDelayMs: number, sleep: (ms: number) => Promise<void> }} options
 * @returns {Promise<{ ok: true, value: T } | { ok: false, reason: string, rateLimited: boolean }>}
 */
async function withRetries(call, { retries, retryDelayMs, sleep }) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return { ok: true, value: await call() };
    } catch (error) {
      lastError = error;
      if (attempt === retries || !isTransient(error)) break;
      await sleep(Math.min(retryDelayMs * 2 ** attempt, 60_000));
    }
  }
  return { ok: false, reason: /** @type {Error} */ (lastError)?.message ?? 'unknown error', rateLimited: isRateLimit(lastError) };
}

/** Marker placed between strings in one request. Letters only, so translators leave it alone. */
const SEPARATOR = 'ZQSEPZQ';
const SEPARATOR_PATTERN = /\s*Z\s*Q\s*S\s*E\s*P\s*Z\s*Q\s*/i;

/**
 * @typedef {{ ok: true, text: string } | { ok: false, reason: string, rateLimited: boolean }} StringResult
 */

/**
 * Translate one string with masking, validation and backoff.
 *
 * @param {object} input
 * @param {{ translate: (text: string, languages: { from: string, to: string }) => Promise<string> }} input.engine
 * @param {string} input.text
 * @param {string} input.from
 * @param {string} input.to
 * @param {string[]} [input.glossary]
 * @param {number} [input.retries]
 * @param {number} [input.retryDelayMs]
 * @param {(ms: number) => Promise<void>} [input.sleep]
 * @returns {Promise<StringResult>}
 */
export async function translateString({ engine, text, from, to, glossary = [], retries = 3, retryDelayMs = 4000, sleep = defaultSleep }) {
  const { text: masked, tokens } = maskProtected(text, glossary);
  if (!hasTranslatableText(masked)) return { ok: true, text };

  const call = await withRetries(() => engine.translate(masked, { from, to }), { retries, retryDelayMs, sleep });
  if (!call.ok) return call;
  const restored = unmask(call.value, tokens);
  if (restored === null) return { ok: false, reason: 'a placeholder or protected term was lost', rateLimited: false };
  if (!samePlaceholders(text, restored)) return { ok: false, reason: 'placeholders changed', rateLimited: false };
  return { ok: true, text: restored };
}

/**
 * Translate several strings in as few requests as possible. They are joined
 * with a marker, sent once, and split back apart. If the translator mangles
 * the marker, or any piece loses a placeholder, only the pieces that did not
 * come back clean are retried one at a time, so a batch can never ship a
 * wrong string; it can only cost extra requests.
 *
 * @param {object} input
 * @param {{ translate: (text: string, languages: { from: string, to: string }) => Promise<string> }} input.engine
 * @param {string[]} input.texts
 * @param {string} input.from
 * @param {string} input.to
 * @param {string[]} [input.glossary]
 * @param {number} [input.retries]
 * @param {number} [input.retryDelayMs]
 * @param {(ms: number) => Promise<void>} [input.sleep]
 * @returns {Promise<{ results: StringResult[], rateLimited: boolean }>}
 */
export async function translateBatch({ engine, texts, from, to, glossary = [], retries = 3, retryDelayMs = 4000, sleep = defaultSleep }) {
  const prepared = texts.map((original) => ({ original, ...maskProtected(original, glossary) }));
  /** @type {StringResult[]} */
  const results = new Array(texts.length);
  /** @type {number[]} */
  const live = [];
  prepared.forEach((item, index) => {
    if (hasTranslatableText(item.text)) live.push(index);
    else results[index] = { ok: true, text: item.original };
  });

  let rateLimited = false;
  if (live.length > 1) {
    const joined = live.map((index) => /** @type {{ text: string }} */ (prepared[index]).text).join(`\n${SEPARATOR}\n`);
    const call = await withRetries(() => engine.translate(joined, { from, to }), { retries, retryDelayMs, sleep });
    if (call.ok) {
      const parts = call.value.split(SEPARATOR_PATTERN).map((part) => part.trim());
      if (parts.length === live.length) {
        live.forEach((index, position) => {
          const item = /** @type {{ original: string, tokens: string[] }} */ (prepared[index]);
          const restored = unmask(/** @type {string} */ (parts[position]), item.tokens);
          if (restored !== null && restored !== '' && samePlaceholders(item.original, restored)) results[index] = { ok: true, text: restored };
        });
      }
    } else if (call.rateLimited) {
      rateLimited = true;
    }
  }

  for (const index of live) {
    if (results[index]) continue;
    if (rateLimited) {
      results[index] = { ok: false, reason: 'rate limited', rateLimited: true };
      continue;
    }
    const single = await translateString({ engine, text: /** @type {{ original: string }} */ (prepared[index]).original, from, to, glossary, retries, retryDelayMs, sleep });
    results[index] = single;
    if (!single.ok && single.rateLimited) rateLimited = true;
  }
  return { results, rateLimited };
}

/**
 * Bring one target locale up to date and write it to disk.
 *
 * @param {object} input
 * @param {string} input.dir Locale directory.
 * @param {string} input.sourceLocale
 * @param {string} input.locale Target locale code.
 * @param {Record<string, unknown>} input.sourceData Parsed source file.
 * @param {Record<string, Record<string, string>>} input.lock Whole lock file, mutated in place.
 * @param {{ name: string, translate: (text: string, languages: { from: string, to: string }) => Promise<string> }} input.engine
 * @param {number} [input.batchSize] Strings per request (1 disables batching).
 * @param {number} [input.batchChars] Soft cap on characters per request.
 * @param {string[]} [input.glossary]
 * @param {string[]} [input.keep]
 * @param {boolean} [input.force]
 * @param {boolean} [input.prune]
 * @param {boolean} [input.dryRun]
 * @param {number} [input.retries]
 * @param {number} [input.retryDelayMs]
 * @param {(ms: number) => Promise<void>} [input.sleep]
 * @param {(line: string) => void} [input.log]
 * @param {boolean} [input.verbose]
 */
export async function syncLocale({
  dir,
  sourceLocale,
  locale,
  sourceData,
  lock,
  engine,
  batchSize = 12,
  batchChars = 3000,
  glossary = [],
  keep = [],
  force = false,
  prune = false,
  dryRun = false,
  retries = 3,
  retryDelayMs = 4000,
  sleep = defaultSleep,
  log = () => {},
  verbose = false,
}) {
  const file = path.join(dir, `${locale}.json`);
  const source = flatten(sourceData);
  const existing = flatten(await readJson(file, {}));
  const langLock = (lock[locale] ??= {});
  const plan = planSync({ source, target: existing, lock: langLock, force, keep });

  const result = {
    locale,
    translated: 0,
    failed: /** @type {Array<{ key: string, reason: string }>} */ ([]),
    adopted: plan.adopt.length,
    upToDate: plan.upToDate,
    broken: plan.broken,
    orphans: plan.orphans.length,
    rateLimited: false,
    remaining: 0,
    wrote: false,
  };

  if (dryRun) {
    result.translated = plan.todo.length;
    return result;
  }

  const merged = { ...existing };
  for (const key of plan.copy) merged[key] = /** @type {string} */ (source[key]);
  for (const key of plan.adopt) langLock[key] = hashText(/** @type {string} */ (source[key]));
  if (prune) for (const key of plan.orphans) {
    delete merged[key];
    delete langLock[key];
  }

  /** @type {string[][]} */
  const batches = [];
  let current = /** @type {string[]} */ ([]);
  let chars = 0;
  for (const key of plan.todo) {
    const length = /** @type {string} */ (source[key]).length;
    if (current.length > 0 && (current.length >= batchSize || chars + length > batchChars)) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(key);
    chars += length;
  }
  if (current.length > 0) batches.push(current);

  for (const keys of batches) {
    const texts = keys.map((key) => /** @type {string} */ (source[key]));
    const { results, rateLimited } = await translateBatch({ engine, texts, from: sourceLocale, to: locale, glossary, retries, retryDelayMs, sleep });
    keys.forEach((key, index) => {
      const outcome = /** @type {StringResult} */ (results[index]);
      if (outcome.ok) {
        merged[key] = outcome.text;
        langLock[key] = hashText(/** @type {string} */ (source[key]));
        result.translated += 1;
        if (verbose) log(`  ${locale} ${key}`);
      } else if (!outcome.rateLimited) {
        result.failed.push({ key, reason: outcome.reason });
      }
    });
    if (rateLimited) {
      // Keep what we have; a later run picks up the rest.
      result.rateLimited = true;
      result.remaining = plan.todo.length - result.translated - result.failed.length;
      break;
    }
  }

  // Write in source order so diffs stay small; keep any orphans at the end unless pruned.
  /** @type {Record<string, string>} */
  const ordered = {};
  for (const key of Object.keys(source)) if (merged[key] !== undefined) ordered[key] = /** @type {string} */ (merged[key]);
  for (const key of Object.keys(merged)) if (!(key in ordered)) ordered[key] = /** @type {string} */ (merged[key]);

  const output = isNested(sourceData) ? unflatten(ordered) : ordered;
  const before = await readJson(file, undefined);
  // Never create a locale file with nothing in it: files are what the game lists as languages.
  const worthWriting = before !== undefined || Object.keys(ordered).length > 0;
  if (worthWriting && JSON.stringify(before) !== JSON.stringify(output)) {
    await writeJson(file, output);
    result.wrote = true;
  }
  return result;
}
