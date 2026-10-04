/**
 * Translation engines.
 *
 * An engine is `{ name, defaultDelayMs, translate(text, { from, to }) }` and
 * resolves to the translated string. Placeholders and glossary terms arrive
 * already masked, so an engine only ever sees plain prose.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { isRateLimit, SEPARATOR } from './sync.js';

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

/** Where Argos names things: bare language codes, plus `zt` for Traditional Chinese. */
const ARGOS_CODES = new Map([
  ['pt-br', 'pt'],
  ['pt-pt', 'pt'],
  ['zh-cn', 'zh'],
  ['zh-hans', 'zh'],
  ['zh-tw', 'zt'],
  ['zh-hk', 'zt'],
  ['zh-hant', 'zt'],
  ['fil', 'tl'],
]);

/** @param {string} code */
export function toArgosCode(code) {
  const lower = code.toLowerCase();
  return ARGOS_CODES.get(lower) ?? /** @type {string} */ (lower.split('-')[0]);
}

const BRIDGE_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'python', 'argos_bridge.py');

/**
 * Offline, unlimited engine: Argos Translate (open-source neural models run on
 * your own machine or CI runner). No key, no quota, no rate limit. The cost is
 * a one-time `pip install argostranslate` and a model download of roughly
 * 100 MB per language, and quality that is a step below Google's, most visibly
 * for Japanese and Korean.
 *
 * It talks to a small Python process over JSON lines. `command` and `args` can
 * be overridden (the tests do that); the Python binary can be chosen with the
 * AUTO_L10N_PYTHON environment variable.
 *
 * @param {{ command?: string, args?: string[] }} [options]
 */
export function argosEngine({ command = process.env['AUTO_L10N_PYTHON'] || 'python3', args = [BRIDGE_SCRIPT] } = {}) {
  /** @type {import('node:child_process').ChildProcessWithoutNullStreams | undefined} */
  let child;
  let nextId = 1;
  let buffer = '';
  /** @type {Map<number, { resolve: (text: string) => void, reject: (error: Error) => void }>} */
  const pending = new Map();

  /** @param {Error} error */
  const failAll = (error) => {
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
  };

  const start = () => {
    const proc = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-2000); });
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (chunk) => {
      buffer += chunk;
      for (let newline = buffer.indexOf('\n'); newline >= 0; newline = buffer.indexOf('\n')) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (!line.trim()) continue;
        try {
          const message = JSON.parse(line);
          const waiter = pending.get(message.id);
          if (!waiter) continue;
          pending.delete(message.id);
          if (typeof message.error === 'string') waiter.reject(new Error(message.error));
          else waiter.resolve(String(message.text));
        } catch {
          // Ignore stray output from libraries that print to stdout.
        }
      }
    });
    proc.on('error', (error) => {
      child = undefined;
      const hint = /** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT'
        ? ` Could not start "${command}". Install Python 3 and run: pip install argostranslate`
        : '';
      failAll(new Error(`Argos engine failed: ${error.message}.${hint}`));
    });
    proc.on('close', (code) => {
      child = undefined;
      failAll(new Error(`Argos engine stopped (exit ${code}). ${stderr.trim().split('\n').slice(-3).join(' ')}`.trim()));
    });
    return proc;
  };

  /** @param {string} text @param {string} from @param {string} to */
  const ask = (text, from, to) => new Promise((resolve, reject) => {
    child ??= start();
    const id = nextId++;
    pending.set(id, { resolve, reject });
    child.stdin.write(`${JSON.stringify({ id, text, from: toArgosCode(from), to: toArgosCode(to) })}\n`, (error) => {
      if (error) { pending.delete(id); reject(error); }
    });
  });

  return {
    name: 'argos',
    defaultDelayMs: 0,
    /** @param {string} text @param {{ from: string, to: string }} languages */
    async translate(text, { from, to }) {
      // The neural model handles one piece of prose at a time; undo batching here
      // rather than trusting it to leave a marker alone.
      if (!text.includes(SEPARATOR)) return /** @type {Promise<string>} */ (ask(text, from, to));
      const pieces = text.split(`\n${SEPARATOR}\n`);
      const out = [];
      for (const piece of pieces) out.push(await ask(piece, from, to));
      return out.join(`\n${SEPARATOR}\n`);
    },
    close() {
      const proc = child;
      child = undefined;
      if (proc) { proc.stdin.end(); proc.kill(); }
    },
  };
}

/**
 * Try engines in order. When one is rate limited, the rest of the run moves on
 * to the next, so a first run finishes in one go instead of waiting hours:
 * Google's wording where it lasts, Argos for whatever is left.
 *
 * @param {Array<{ name: string, translate: (text: string, languages: { from: string, to: string }) => Promise<string>, close?: () => void }>} engines
 * @param {{ onSwitch?: (from: string, to: string) => void }} [options]
 */
export function chainEngine(engines, { onSwitch } = {}) {
  if (engines.length === 1) return /** @type {typeof engines[0]} */ (engines[0]);
  let active = 0;
  return {
    name: engines.map((engine) => engine.name).join(' then '),
    defaultDelayMs: 0,
    /** @param {string} text @param {{ from: string, to: string }} languages */
    async translate(text, languages) {
      for (;;) {
        const index = active;
        const engine = /** @type {typeof engines[0]} */ (engines[index]);
        try {
          return await engine.translate(text, languages);
        } catch (error) {
          const next = engines[index + 1];
          if (!isRateLimit(error) || !next) throw error;
          if (active === index) {
            active = index + 1;
            onSwitch?.(engine.name, next.name);
          }
        }
      }
    },
    close() {
      for (const engine of engines) engine.close?.();
    },
  };
}

/**
 * Build the engine named by `--engine`: one spec, or several separated by
 * commas ("google,argos") to chain them. Network engines are paced by
 * `delayMs`; local ones are not.
 *
 * @param {string} spec
 * @param {string} cwd
 * @param {{ delayMs?: number, onSwitch?: (from: string, to: string) => void }} [options]
 */
export async function buildEngine(spec, cwd, { delayMs, onSwitch } = {}) {
  const parts = (spec === 'auto' ? 'google,argos' : spec).split(',').map((part) => part.trim()).filter(Boolean);
  const engines = [];
  for (const part of parts) {
    const engine = await loadEngine(part, cwd);
    const pace = engine.defaultDelayMs > 0 ? (delayMs ?? engine.defaultDelayMs) : 0;
    engines.push(paceEngine(engine, pace));
  }
  return chainEngine(engines, { onSwitch });
}

/**
 * Resolve one `--engine` name: "google", "argos", "pseudo", or a path to a module whose default
 * export is an engine object or a function returning one.
 *
 * @param {string} spec
 * @param {string} cwd
 */
export async function loadEngine(spec, cwd) {
  if (spec === 'google') return googleEngine();
  if (spec === 'pseudo') return pseudoEngine();
  if (spec === 'argos') return argosEngine();
  const file = path.resolve(cwd, spec);
  const mod = await import(pathToFileURL(file).href);
  const candidate = typeof mod.default === 'function' ? await mod.default() : mod.default;
  if (!candidate || typeof candidate.translate !== 'function') {
    throw new Error(`Engine "${spec}" must default-export an object with a translate(text, { from, to }) function.`);
  }
  return { name: spec, defaultDelayMs: 1200, ...candidate };
}
