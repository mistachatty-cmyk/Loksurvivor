/**
 * Translation engines.
 *
 * An engine is `{ name, defaultDelayMs, translate(text, { from, to }) }` and
 * resolves to the translated string. Placeholders and glossary terms arrive
 * already masked, so an engine only ever sees plain prose.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Codes where Google's name differs from the BCP 47 tag used for file names. */
const GOOGLE_CODES = new Map([
  ['pt-br', 'pt'],
  ['pt-pt', 'pt'],
  ['zh', 'zh-CN'],
  ['zh-hans', 'zh-CN'],
  ['zh-hant', 'zh-TW'],
  ['nb', 'no'],
  ['fil', 'tl'],
]);

/** @param {string} code */
export function toGoogleCode(code) {
  const mapped = GOOGLE_CODES.get(code.toLowerCase());
  if (mapped) return mapped;
  // Everything else is sent as the bare language, except the two Chinese forms handled above.
  return code.includes('-') ? /** @type {string} */ (code.split('-')[0]) : code;
}

/**
 * Free, key-less engine backed by the public Google Translate web endpoint
 * through `@vitalets/google-translate-api`. Good enough for a first pass; it
 * is rate limited per IP and Google can change it at any time.
 */
export function googleEngine() {
  /** @type {((text: string, options: object) => Promise<{ text: string }>) | undefined} */
  let translate;
  return {
    name: 'google',
    defaultDelayMs: 1200,
    /**
     * @param {string} text
     * @param {{ from: string, to: string }} languages
     */
    async translate(text, { from, to }) {
      if (!translate) {
        const mod = await import('@vitalets/google-translate-api');
        translate = mod.translate;
      }
      const result = await translate(text, { from: toGoogleCode(from), to: toGoogleCode(to) });
      return result.text;
    },
  };
}

const PSEUDO_MAP = {
  a: 'á', b: 'ƀ', c: 'ç', d: 'đ', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'î', j: 'ĵ', k: 'ķ', l: 'ļ', m: 'ɱ',
  n: 'ñ', o: 'ö', p: 'þ', r: 'ŕ', s: 'š', t: 'ţ', u: 'ü', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž',
};

/**
 * Offline engine for testing. It rewrites lowercase letters as accented
 * lookalikes and pads the text by about 30 percent inside brackets, so any
 * hard-coded string, clipped label or broken layout is obvious on screen.
 * Never ship its output as a real language.
 */
export function pseudoEngine() {
  return {
    name: 'pseudo',
    defaultDelayMs: 0,
    /** @param {string} text */
    async translate(text) {
      const body = text.replace(/[a-z]/g, (letter) => /** @type {Record<string, string>} */ (PSEUDO_MAP)[letter] ?? letter);
      return `[${body}${'~'.repeat(Math.ceil(text.length * 0.3))}]`;
    },
  };
}

/** @param {number} ms */
const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wrap an engine so calls start at least `delayMs` apart (with a little
 * jitter), however many languages are running at once. One wrapper is shared by
 * the whole run, so the pacing is global and not per language.
 *
 * @template {{ translate: (text: string, languages: { from: string, to: string }) => Promise<string> }} E
 * @param {E} engine
 * @param {number} delayMs
 * @param {(ms: number) => Promise<void>} [sleep]
 * @returns {E}
 */
export function paceEngine(engine, delayMs, sleep = defaultSleep) {
  if (delayMs <= 0) return engine;
  let last = 0;
  let gate = Promise.resolve();
  return {
    ...engine,
    async translate(text, languages) {
      const turn = gate.then(async () => {
        const wait = last + delayMs * (0.85 + Math.random() * 0.3) - Date.now();
        if (wait > 0) await sleep(wait);
        last = Date.now();
      });
      gate = turn.catch(() => {});
      await turn;
      return engine.translate(text, languages);
    },
  };
}

/**
 * Resolve `--engine`: "google", "pseudo", or a path to a module whose default
 * export is an engine object or a function returning one.
 *
 * @param {string} spec
 * @param {string} cwd
 */
export async function loadEngine(spec, cwd) {
  if (spec === 'google') return googleEngine();
  if (spec === 'pseudo') return pseudoEngine();
  const file = path.resolve(cwd, spec);
  const mod = await import(pathToFileURL(file).href);
  const candidate = typeof mod.default === 'function' ? await mod.default() : mod.default;
  if (!candidate || typeof candidate.translate !== 'function') {
    throw new Error(`Engine "${spec}" must default-export an object with a translate(text, { from, to }) function.`);
  }
  return { name: spec, defaultDelayMs: 1200, ...candidate };
}
