# LOK ecosystem tooling (`packages/lok-ecosystem`)

- Catalog of plugins is typed in `src/catalog.ts`; `docs/lok-plugins.json` is generated (`lok:catalog`, test + CI fail if stale);
  `docs/LOK_ECOSYSTEM.md` is the prose guide and a test requires every plugin id to appear in it.
- `checkManifest` knows the base manifest plus `lokErrorReport` and `lokChat` (features validated against `CHAT_FEATURES`).
  The vendored SDK does not carry those two blocks yet; `SDK_SCHEMA_PATCH` is the text to add in `Lok-EcoSystsem/universe-sdk`.
- `lok:new-app <name>` scaffolds `artifacts/<name>` (headless starter: manifest, chat cast + runtime, crash capture, contract test).
  Verified by generating, installing, typechecking and testing it; the generated folder was deleted afterwards (do the same when testing).
- `lok:status --write` regenerates `docs/ECOSYSTEM_STATUS.md`; run it when an app manifest changes.
- Not done: moving the LOK Chat overlay into `@lok/chat`, SDK schema entries, extraction to separate repos.
