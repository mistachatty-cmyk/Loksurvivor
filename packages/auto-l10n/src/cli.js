/**
 * Command line interface for @lok/auto-l10n.
 *
 *   auto-l10n sync    translate missing and changed strings (default)
 *   auto-l10n check   exit 1 if any locale is missing or out of date (no network)
 *   auto-l10n init    write a config, a starter en.json and the GitHub workflow
 *   auto-l10n scan    estimate how much English is still hard-coded in source
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { flatten } from './core.js';
import { loadEngine } from './engines.js';
import { scanSource } from './scan.js';
import { LOCK_FILE, planSync, readJson, syncLocale, writeJson } from './sync.js';

const DEFAULT_TARGETS = ['es', 'fr', 'de', 'pt-BR', 'ja', 'ko', 'zh-CN'];
const LOCALE_FILE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]+)*\.json$/;

const HELP = `auto-l10n: free, automatic JSON localization for games

Usage: auto-l10n [command] [options]

Commands
  sync    Translate missing and changed strings (default)
  check   Exit 1 if any locale is missing or out of date; no network
  init    Create l10n.config.json, locales/en.json and .github/workflows/auto-l10n.yml
  scan    Estimate how much English is still hard-coded in source files

Options
  --config <file>        Config file (default: ./l10n.config.json if present)
  --dir <path>           Locale directory (default: locales)
  --source <code>        Source language (default: en)
  --targets <a,b,c>      Languages to produce (default: existing files, else from config)
  --engine <name|path>   google (default, free, no key), pseudo (offline test), or a module path
  --delay <ms>           Pause between translation requests (default: 1200 for google)
  --concurrency <n>      Languages translated in parallel (default: 1)
  --retries <n>          Retries per string on rate limit or network error (default: 3)
  --force                Retranslate every string, even unchanged ones
  --prune                Delete keys from targets that no longer exist in the source
  --dry-run              Report what would change; write nothing
  --strict               Exit 1 if any string could not be translated
  --src <path>           scan: directory to scan (default: .)
  --verbose              Print every translated key
  -h, --help             Show this help

Config file (l10n.config.json)
  { "dir": "locales", "source": "en", "targets": ["es", "fr"],
    "glossary": ["MyGame"], "keep": ["brand.*"], "delayMs": 1200 }
  glossary: terms kept verbatim in every language. keep: key patterns copied, not translated.
`;

/** @param {string} line */
function annotate(line) {
  if (process.env['GITHUB_ACTIONS']) console.log(`::warning::${line}`);
  else console.warn(`warning: ${line}`);
}

/**
 * @param {string[]} argv
 * @param {{ cwd?: string, log?: (line: string) => void }} [env]
 * @returns {Promise<number>} Process exit code.
 */
export async function run(argv, env = {}) {
  const cwd = env.cwd ?? process.cwd();
  const log = env.log ?? ((/** @type {string} */ line) => console.log(line));

  const { values: flags, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      config: { type: 'string' },
      dir: { type: 'string' },
      source: { type: 'string' },
      targets: { type: 'string' },
      engine: { type: 'string' },
      delay: { type: 'string' },
      concurrency: { type: 'string' },
      retries: { type: 'string' },
      src: { type: 'string' },
      force: { type: 'boolean' },
      prune: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      strict: { type: 'boolean' },
      verbose: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  const command = positionals[0] ?? 'sync';
  if (flags.help || command === 'help') {
    log(HELP);
    return 0;
  }

  if (command === 'init') return init(cwd, log);
  if (command === 'scan') return scan(path.resolve(cwd, flags.src ?? '.'), log, Boolean(flags.verbose));
  if (command !== 'sync' && command !== 'check') {
    console.error(`Unknown command "${command}". Run with --help.`);
    return 2;
  }

  const config = await loadConfig(flags, cwd);
  const sourceFile = path.join(config.dir, `${config.source}.json`);
  const sourceData = await readJson(sourceFile, undefined);
  if (sourceData === undefined) {
    console.error(`Source file not found: ${sourceFile}\nRun "auto-l10n init" or pass --dir / --config.`);
    return 2;
  }
  const source = flatten(sourceData);
  const lockFile = path.join(config.dir, LOCK_FILE);
  /** @type {Record<string, Record<string, string>>} */
  const lock = await readJson(lockFile, {});

  const targets = await resolveTargets(config);
  if (targets.length === 0) {
    console.error('No target languages. Pass --targets es,fr or add "targets" to l10n.config.json.');
    return 2;
  }

  if (command === 'check') return check({ config, source, lock, targets, log });

  const engine = await loadEngine(config.engine, cwd);
  const delayMs = config.delayMs ?? engine.defaultDelayMs ?? 0;
  log(`${Object.keys(source).length} source strings in ${config.source}.json; ${targets.length} target language(s) via ${engine.name}${config.dryRun ? ' (dry run)' : ''}.`);

  /** @type {Awaited<ReturnType<typeof syncLocale>>[]} */
  const results = [];
  const queue = [...targets];
  const workers = Array.from({ length: Math.max(1, Math.min(config.concurrency, queue.length)) }, async () => {
    for (let locale = queue.shift(); locale !== undefined; locale = queue.shift()) {
      const result = await syncLocale({
        dir: config.dir,
        sourceLocale: config.source,
        locale,
        sourceData,
        lock,
        engine,
        delayMs,
        glossary: config.glossary,
        keep: config.keep,
        force: config.force,
        prune: config.prune,
        dryRun: config.dryRun,
        retries: config.retries,
        log,
        verbose: config.verbose,
      });
      results.push(result);
      log(`${locale.padEnd(8)} ${result.translated} ${config.dryRun ? 'to translate' : 'translated'}, ${result.upToDate + result.adopted} kept${result.failed.length ? `, ${result.failed.length} failed` : ''}${result.rateLimited ? ' (rate limited, run again later)' : ''}`);
    }
  });
  await Promise.all(workers);

  if (!config.dryRun) {
    // Drop lock data for languages that are no longer targets only when pruning.
    if (config.prune) for (const code of Object.keys(lock)) if (!targets.includes(code)) delete lock[code];
    await writeJson(lockFile, sortLock(lock));
  }

  let failures = 0;
  for (const result of results) {
    for (const { key, reason } of result.failed) {
      failures += 1;
      annotate(`${result.locale}: could not translate "${key}": ${reason}`);
    }
    for (const key of result.broken) annotate(`${result.locale}: "${key}" uses different {{placeholders}} than the source`);
  }
  return failures > 0 && config.strict ? 1 : 0;
}

/**
 * @param {Record<string, Record<string, string>>} lock
 */
function sortLock(lock) {
  /** @type {Record<string, Record<string, string>>} */
  const out = {};
  for (const code of Object.keys(lock).sort()) {
    out[code] = Object.fromEntries(Object.entries(/** @type {Record<string, string>} */ (lock[code])).sort(([a], [b]) => a.localeCompare(b)));
  }
  return out;
}

/**
 * @param {{ config: Awaited<ReturnType<typeof loadConfig>>, source: Record<string, string>, lock: Record<string, Record<string, string>>, targets: string[], log: (line: string) => void }} input
 */
async function check({ config, source, lock, targets, log }) {
  let problems = 0;
  for (const locale of targets) {
    const file = path.join(config.dir, `${locale}.json`);
    const existing = flatten(await readJson(file, {}));
    const plan = planSync({ source, target: existing, lock: lock[locale] ?? {}, keep: config.keep });
    const issues = [];
    if (plan.missing.length) issues.push(`${plan.missing.length} missing`);
    if (plan.stale.length) issues.push(`${plan.stale.length} out of date`);
    if (plan.broken.length) issues.push(`${plan.broken.length} with mismatched placeholders`);
    problems += plan.missing.length + plan.stale.length + plan.broken.length;
    log(`${locale.padEnd(8)} ${issues.length ? issues.join(', ') : 'ok'}`);
  }
  return problems > 0 ? 1 : 0;
}

/**
 * @param {Record<string, string | boolean | undefined>} flags
 * @param {string} cwd
 */
async function loadConfig(flags, cwd) {
  const explicit = typeof flags['config'] === 'string' ? path.resolve(cwd, flags['config']) : undefined;
  const configPath = explicit ?? path.join(cwd, 'l10n.config.json');
  /** @type {Record<string, any>} */
  let file = {};
  let base = cwd;
  try {
    file = JSON.parse(await fs.readFile(configPath, 'utf8'));
    base = path.dirname(configPath);
  } catch (error) {
    if (explicit || /** @type {NodeJS.ErrnoException} */ (error).code !== 'ENOENT') {
      throw new Error(`Could not read config ${configPath}: ${/** @type {Error} */ (error).message}`);
    }
  }

  const num = (/** @type {unknown} */ flag, /** @type {unknown} */ fromFile, /** @type {number | undefined} */ fallback) => {
    const value = flag !== undefined ? Number(flag) : fromFile !== undefined ? Number(fromFile) : fallback;
    return value;
  };

  return {
    dir: flags['dir'] ? path.resolve(cwd, String(flags['dir'])) : path.resolve(base, file.dir ?? 'locales'),
    source: String(flags['source'] ?? file.source ?? 'en'),
    targets: flags['targets'] ? String(flags['targets']).split(',').map((s) => s.trim()).filter(Boolean) : /** @type {string[] | undefined} */ (file.targets),
    engine: String(flags['engine'] ?? file.engine ?? 'google'),
    delayMs: num(flags['delay'], file.delayMs, undefined),
    concurrency: num(flags['concurrency'], file.concurrency, 1) ?? 1,
    retries: num(flags['retries'], file.retries, 3) ?? 3,
    glossary: /** @type {string[]} */ (file.glossary ?? []),
    keep: /** @type {string[]} */ (file.keep ?? []),
    force: Boolean(flags['force']),
    prune: Boolean(flags['prune']),
    dryRun: Boolean(flags['dry-run']),
    strict: Boolean(flags['strict']),
    verbose: Boolean(flags['verbose']),
  };
}

/** @param {Awaited<ReturnType<typeof loadConfig>>} config */
async function resolveTargets(config) {
  if (config.targets?.length) return config.targets.filter((code) => code !== config.source);
  try {
    return (await fs.readdir(config.dir))
      .filter((name) => LOCALE_FILE.test(name))
      .map((name) => name.replace(/\.json$/, ''))
      .filter((code) => code !== config.source)
      .sort();
  } catch {
    return [];
  }
}

/**
 * @param {string} cwd
 * @param {(line: string) => void} log
 */
async function init(cwd, log) {
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  /** @type {Array<[string, () => Promise<string>]>} */
  const files = [
    ['l10n.config.json', async () => `${JSON.stringify({ dir: 'locales', source: 'en', targets: DEFAULT_TARGETS, glossary: [], keep: [] }, null, 2)}\n`],
    ['locales/en.json', async () => `${JSON.stringify({ 'game.title': 'My Game', 'menu.play': 'Play', 'hud.score': 'Score: {{score}}' }, null, 2)}\n`],
    ['.github/workflows/auto-l10n.yml', () => fs.readFile(path.join(packageRoot, 'action-template.yml'), 'utf8')],
  ];
  for (const [relative, make] of files) {
    const target = path.join(cwd, relative);
    try {
      await fs.access(target);
      log(`skip   ${relative} (already exists)`);
    } catch {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, await make(), 'utf8');
      log(`create ${relative}`);
    }
  }
  log('\nNext: edit locales/en.json, commit and push. The workflow translates it into every target language.');
  return 0;
}

/**
 * @param {string} root
 * @param {(line: string) => void} log
 * @param {boolean} verbose
 */
async function scan(root, log, verbose) {
  const { files, total } = await scanSource(root);
  log(`About ${total} hard-coded user-facing string(s) in ${files.length} file(s) under ${root} (heuristic).`);
  for (const { file, strings } of files.slice(0, verbose ? files.length : 15)) {
    log(`${String(strings.length).padStart(5)}  ${file}`);
    if (verbose) for (const text of strings.slice(0, 5)) log(`         ${text.slice(0, 90)}`);
  }
  if (!verbose && files.length > 15) log(`  ...and ${files.length - 15} more file(s). Use --verbose for all.`);
  return 0;
}
