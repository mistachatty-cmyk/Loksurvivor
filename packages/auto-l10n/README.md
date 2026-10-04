# @lok/auto-l10n

Free, automatic localization for HTML5 and Canvas games.

You write English once. Every time you push a change to `locales/en.json`, a GitHub Action translates the new and changed strings into your other languages and commits the files back. No API keys, no accounts, no monthly bill.

It is a first pass, not a professional translation. It gets players most of the way there on day one, and anything a human fixes by hand is kept (see [Fixing a translation](#fixing-a-translation)).

The package has two parts:

| Part | What it is |
| :--- | :--- |
| **Runtime** (`src/index.js`) | A small browser-safe class with `t('key')`, `{{variables}}`, plurals, lazy loading and language detection. No dependencies. |
| **CLI + Action** (`auto-l10n`) | Reads `locales/en.json`, translates whatever is missing or changed, writes `es.json`, `fr.json` and so on. Runs locally or in GitHub Actions. |

## Set up a game in three steps

**1. Install and scaffold**

```bash
npm install @lok/auto-l10n
npx auto-l10n init
```

`init` creates `l10n.config.json`, a starter `locales/en.json` and `.github/workflows/auto-l10n.yml`. It never overwrites a file that already exists. The workflow is also available as `action-template.yml` in this package if you prefer to copy it by hand.

**2. Put your text in `locales/en.json`**

```json
{
  "menu.play": "Play",
  "hud.score": "Score: {{score}}",
  "loot.count_one": "{{count}} item",
  "loot.count_other": "{{count}} items"
}
```

Keys can be flat (`"menu.play"`) or nested (`{ "menu": { "play": "Play" } }`). Translated files copy whichever shape the source uses. Keys that start with `_` are ignored, so `"_comment"` is safe.

**3. Push to GitHub**

The workflow runs, translates, and commits `locales/es.json`, `fr.json`, and the rest. Which languages you get is set by `targets` in `l10n.config.json`. The default is `es`, `fr`, `de`, `pt-BR`, `ja`, `ko` and `zh-CN`.

## Use it in your game

```js
import { createL10n, detectLocale } from '@lok/auto-l10n';
import en from './locales/en.json';

// Other languages load on demand. This works with Vite; any bundler with dynamic import will do.
const files = import.meta.glob('./locales/*.json', { import: 'default' });
const codes = Object.keys(files).map((path) => path.match(/\/([^/]+)\.json$/)[1]);

export const l10n = createL10n({
  defaultLocale: 'en',
  messages: { en },
  supported: codes,
  loadLocale: (code) => files[`./locales/${code}.json`](),
});

// Pick a starting language: a saved choice first, then the browser's list, then English.
await l10n.setLocale(detectLocale({
  supported: codes,
  stored: localStorage.getItem('lang'),
  languages: navigator.languages,
}));

l10n.t('menu.play');                      // "Jugar"
l10n.t('hud.score', { score: 120 });      // "Puntos: 120"
l10n.t('loot.count', { count: 3 });       // "3 objetos"  (picks loot.count_other)
```

Draw the result on your canvas like any other string: `ctx.fillText(l10n.t('menu.play'), x, y)`. When the language changes, `l10n.subscribe(fn)` tells you to redraw. A missing key falls back to English, then to the key itself, so a gap is visible but never blank.

In TypeScript, `createL10n<keyof typeof en>(...)` makes `t()` reject keys that are not in your English file.

### Runtime API

| Call | What it does |
| :--- | :--- |
| `createL10n(options)` | Make a manager. Options: `defaultLocale`, `messages`, `supported`, `loadLocale`, `onMissing`. |
| `l10n.setLocale(code)` | Switch language. `es-MX` resolves to `es`. Loads the file once. If loading fails, the current language stays and nothing throws. |
| `l10n.t(key, vars?)` | Translate. `{{name}}` is replaced from `vars`. A numeric `count` picks `key_one`, `key_other` and so on. |
| `l10n.has(key)` | Whether a key has text. |
| `l10n.number(n)`, `l10n.date(d)` | `Intl` formatting for the active language. |
| `l10n.subscribe(fn)` | Run `fn` after every language change. Returns an unsubscribe function. |
| `detectLocale`, `resolveLocale`, `directionOf` | Helpers for choosing a language and for `rtl` or `ltr`. |

## Command line

```text
auto-l10n sync     Translate missing and changed strings (the default)
auto-l10n check    Exit 1 if any language is missing or out of date. No network.
auto-l10n init     Create config, starter en.json and the workflow
auto-l10n scan     Estimate how much English is still hard-coded in source files
```

Useful options: `--targets es,fr`, `--dir locales`, `--config path/to/l10n.config.json`, `--delay 1500`, `--batch 8`, `--force`, `--prune`, `--dry-run`, `--strict`, `--engine google,argos`, `--engine pseudo`. Run `auto-l10n --help` for all of them.

### Config file

```json
{
  "dir": "locales",
  "source": "en",
  "targets": ["es", "fr", "de", "pt-BR", "ja", "ko", "zh-CN"],
  "glossary": ["MyGame", "Zorbo"],
  "keep": ["brand.*"],
  "delayMs": 1200
}
```

- **glossary**: names and terms kept exactly as written in every language. Add your game's title, characters and invented words, or the translator will "translate" them.
- **keep**: key patterns that are copied from English and never translated.
- **dir** is relative to the config file, which is how a monorepo points at one game's folder.

## How it works

- **Incremental.** `locales/.l10n-lock.json` records which English text each translation was made from. A string is translated again only when it is missing or its English changed. Commit this file.
- **Placeholders are protected.** `{{name}}` and glossary terms are swapped for opaque tokens before translation and restored after. A translation that loses one is rejected, and the key stays untranslated (so it falls back to English) instead of shipping broken text.
- **Two engines, so there is no wall.** The default is `google,argos`: Google's free web endpoint first (best wording), spaced about 1.2 seconds apart across all languages. If Google rate limits the machine, the rest of the run switches to [Argos Translate](https://github.com/argosopentech/argostranslate), open-source models that run on the runner itself with no key, no quota and no rate limit. A first run therefore always finishes. If both engines fail, the run stops, keeps what it finished, never writes an empty language file, and the next run (the templates include a scheduled one) continues from there.
- **Never destructive.** A hand-written translation with no lock entry is adopted, not replaced. Keys you removed from English stay in other languages until you run with `--prune`.

### Speed

About a dozen strings travel in each request (`--batch`, or `batchSize` in the config), joined with a marker the translator leaves alone and split back apart afterwards. If the marker comes back mangled, or a piece loses a placeholder, only that piece is retried on its own, so batching can cost extra requests but never ships a wrong string. With 300 strings and 7 languages that is roughly 180 requests, about four minutes. After that, a push touching a few strings takes seconds. `--concurrency 2` runs two languages at once, at a higher risk of rate limits.

### Fixing a translation

Open `locales/es.json`, edit the string, commit. The lock file sees that the English did not change and leaves your edit alone. If the English changes later, the string is retranslated and your edit is replaced, since it was a fix for the old wording.

## Limitations

Worth knowing before you rely on it:

- **Machine quality.** Short UI labels come out fine. Jokes, slang, lore and anything with wordplay will not. Review the languages you care about most.
- **Argos quality.** It is a step below Google, most noticeably for Japanese and Korean, and it needs Python 3 plus `pip install argostranslate` (the workflow templates do this, with CPU-only torch and a model cache) and about 100 MB of model per language on first use. Locally, set `AUTO_L10N_PYTHON` to pick the Python binary. Use `--engine argos` to force it everywhere, or `--engine google` to never use it. Strings it translates are normal files: fix any you dislike by hand and the edit is kept.
- **The Google engine is unofficial.** It uses the public Google Translate web endpoint through [`@vitalets/google-translate-api`](https://github.com/vitalets/google-translate-api). Its author recommends the official paid API for anything beyond hobby and prototype use. It has no uptime promise and can be rate limited or change without notice. If it breaks, the game keeps working in English. You can plug in a different service with `--engine ./my-engine.js` (default-export `{ translate(text, { from, to }) }`).
- **Plurals are basic.** `key_one` and `key_other` work. Languages that need `few` or `many` (Russian, Polish, Arabic) fall back to `key_other` unless you add those keys by hand.
- **Right-to-left languages** translate fine, but your layout is your own responsibility. `directionOf()` tells you when to flip it.
- **It translates strings, not images.** Text drawn into artwork needs its own versions.

## Testing your layouts

`auto-l10n sync --engine pseudo --targets qps` writes a fake language that rewrites English as accented lookalikes padded by about 30 percent, like `[Pļáý~]`. Select it in your game to find hard-coded text (still plain English), clipped labels and overflowing buttons. It runs offline. Do not ship it, and delete `qps.json` and its lock entries afterward.

## Finding hard-coded text

`auto-l10n scan --src src` gives a rough count of user-facing English still written directly in `.tsx`, `.jsx` and `.html` files. It is a heuristic with some false positives and misses, so treat the total as a progress meter.

## Troubleshooting

- **"Updates were rejected" on the commit step.** Someone pushed while the job ran. Re-run the workflow; it picks up where it stopped.
- **Nothing happens on push.** The workflow only triggers when `locales/en.json` changes. Adjust `paths:` if your folder is elsewhere. You can also run it from the Actions tab with "Run workflow".
- **Protected branch.** The default commit step pushes straight to the branch. If that branch is protected, run the job on a branch that is not, or open a pull request with a different commit action.
- **A language failed.** The log shows a warning per string. Run `auto-l10n sync` again later; failed strings are retried automatically.

## License

MIT
