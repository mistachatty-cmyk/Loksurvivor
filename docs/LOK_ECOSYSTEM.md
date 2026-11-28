# The LOK ecosystem: plugins, conventions and tooling

The LOK ecosystem is a set of shared plugins and a contract (`lok.universe.json`) that any LOK app can adopt, so every
game or app gets the same crash handling, chat, wallet, cards and updates feed without rebuilding them. 616 Survivor is
the reference app. The machine-readable catalog is `docs/lok-plugins.json` (generated from
`packages/lok-ecosystem/src/catalog.ts`); live status of every app is `docs/ECOSYSTEM_STATUS.md`.

All plugins follow `docs/LOK_COST_DISCIPLINE.md`: free to run, no runtime LLM, no new hosting, cached shared feeds.

## Plugins
| Plugin | Status | Where | Manifest block | What it gives an app |
| --- | --- | --- | --- | --- |
| `universe-sdk` | stable | `lib/lok-universe` (vendored) | `schema` | Cards, rarity, wallet strip, supporter bar, playtime, achievements contracts |
| `lok-client` | stable | `lib/lok-client` | none | Sign-in, saves, economy, LokDex, feedback, supporters |
| `lok-focus-widget` | stable | `lib/lok-focus-widget` | none | An embeddable focus overlay |
| `@lok/error-report` | stable | `packages/lok-error-report` | `lokErrorReport` | Crash capture, themed pop-up, repo and CI crash docs (`docs/LOK_ERROR_REPORT.md`) |
| `@lok/chat` | beta | `packages/lok-chat` | `lokChat` | Conversation engine, crew scenes, group chat, moods, memory (`docs/LOK_CHAT.md`) |
| `@lok/recap` | beta | `packages/recap` | none | Run recaps and poster cards |
| `@lok/auto-l10n` | stable | `packages/auto-l10n` | none | Auto-translation of `en.json` |
| `@lok/ecosystem` | beta | `packages/lok-ecosystem` | none | This catalog, `lok:check`, `lok:status`, `lok:new-app` |
| `lokserver-knowledge` | planned | none | none | The shop host as a shared plugin (`docs/lokserver-knowledge.md`) |
| `lok-world-feed` | planned | none | none | One cached daily feed and fixed-phrase postcards (`docs/LOK_CHAT_ROADMAP.md`) |

## Conventions every plugin follows
1. **Framework-agnostic core, thin adapters.** Pure logic first (seeded, testable); React or Vite pieces on subpaths.
2. **Nothing 616-specific inside a package.** An app supplies a config object (a `ChatCast`, a reporter config) and strings.
3. **Two switches.** The app's manifest block says whether the plugin may run; the player's Settings can turn it (or each
   feature) off. Off means nothing is generated, stored or sent.
4. **A validator and a quality gate.** `validateCast`, `checkManifest`, transcript tests: every app runs them in its own tests.
5. **Privacy by default.** Player text is never stored or echoed; nothing leaves the device unless the player sends it.
6. **Docs, memory note, changelog.** Each plugin has a spec in `docs/`, a note in `.agents/memory/`, and bumps the app version when players see a change.

## Tooling (`pnpm --filter @lok/ecosystem <script>`)
- `lok:check`: validates every `artifacts/*/lok.universe.json` (also run in CI). Knows the `lokErrorReport` and `lokChat`
  blocks; `SDK_SCHEMA_PATCH` in `src/manifest.ts` is the text to add to `Lok-EcoSystsem/universe-sdk` so the vendored
  `PlatformManifest` carries them (never edit `lib/lok-universe` here).
- `lok:status [--write | --check]`: per app, which plugins are on, SDK version, manifest problems; `--write` updates `docs/ECOSYSTEM_STATUS.md`, `--check` fails in CI if it is stale.
- `lok:catalog [--check]`: regenerates (or verifies) `docs/lok-plugins.json`.
- `lok:new-app <name> [--label "Name"] [--no-chat] [--no-errors]`: scaffolds `artifacts/<name>` with a valid manifest, the
  chat plugin on a starter cast, crash capture, and a contract test. It never overwrites an existing folder.

## Adding an app
1. `pnpm --filter @lok/ecosystem lok:new-app my-game`, then `pnpm install`.
2. Replace the starter cast with your own people, add your UI, and keep `pnpm --filter @workspace/my-game test` green.
3. `lok:check` and `lok:status --write`; commit `docs/ECOSYSTEM_STATUS.md`.
4. Add the app to the hub through the process in `Lok-EcoSystsem/LokToken EcoSystem/LOK_PLATFORMS.md`.

## Adding a plugin
Add a row to `PLUGINS` in `packages/lok-ecosystem/src/catalog.ts`, run `lok:catalog`, mention it in the table above (a test
checks), add its manifest block to `checkManifest` and `SDK_SCHEMA_PATCH`, and follow the conventions.

## Still open
Add the `lokChat` / `lokErrorReport` entries to the SDK (paste-ready: `docs/SDK_PATCH_lokChat_lokErrorReport.md`); extract plugins
into their own repos once a second app exists; the planned plugins above. The LOK Chat window now lives in `@lok/chat/react`.
