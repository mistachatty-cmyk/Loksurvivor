# LokErrorReport

LokServer the owl catches a game's crashes, says exactly what went wrong, and stores the report wherever you
want. Lives in `packages/lok-error-report` (`@lok/error-report`) with zero game imports so it can move to its
own repo and be sold as a LOK Ecosystem plugin.

## What a player / developer sees
- React render crash: full-screen LokServer pop-up. Global error / rejection: small chip that opens the same pop-up.
- **Dev**: exact `file:line:col`, the code line (source-mapped through the Vite dev server) and the component stack.
- **Production / no source access**: "LOK doesn't have access to the code behind this one." Messages and stacks
  are never shown (they can carry API responses). The report ID and build ID are.
- Buttons: Copy report, Download .md, Send to LOK (only when a cloud sink exists), Try again, Close.

## Switch
`enabled = manifest lokErrorReport.enabled && player setting (default on)`. Off = no capture, no storage, no
sending; the old plain fallback stays. Manifest block in `lok.universe.json`:
`"lokErrorReport": { "enabled": true, "source": "616_survivor" }`.
The manifest schema lives in the vendored SDK: `Lok-EcoSystsem/universe-sdk` needs the matching entry.

## Storage (sinks)
`ReportSink { id, send(report) }`; a sink may return `{ source }` enrichment. Shipped: device log (last 25),
callback, webhook, `lokFeedbackSink` (existing `product_feedback`, only when the player presses Send;
auto-send is a setting, default off), `repoDocsSink` (dev only, `POST /__lok/error-report`).
The dev endpoint: fixed output dir, file name from the validated fingerprint, `x-lok-error-report` header,
origin/host check, body cap, 200-file cap. Production ships no source maps and no endpoint.

## Repo documentation
- Dev crashes -> `docs/errors/<fingerprint>.md`; `pnpm errors:docs` -> `docs/ERRORS.md`.
- CI (`.github/workflows/ci.yml`) wraps each step in `scripts/ci-report.ts`: annotations, job summary and a
  `lok-crash-report` artifact. No auto-commit, no issues.

## Extraction checklist
1. Move `packages/lok-error-report` to its own repo; keep subpath exports (`.`, `./sinks`, `./react`, `./vite`, `./ci`).
2. Publish; replace the relative `vite.config.ts` import with the package name once it is built JS.
3. Add the `lokErrorReport` schema entry to `universe-sdk` and run `sync-sdk.sh`.
4. Add sinks (issue trackers, email, storage buckets) without touching core.
