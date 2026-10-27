# Shared music implementation — 2026-10-27

Owner: Codex. Status: ready for review; not deployed.
Related work: mistachatty-cmyk/Loksurvivor#370.
Branches: `codex/shared-music-forgettable-data` in Lok-EcoSystsem, Loksurvivor, Gsixhub.

Completed:
- Canonical catalog and shared player source moved into Lok-EcoSystsem ownership. Legacy Lokifed release/track keys and objective gates retained.
- Catalog lists Lokifed, DJ Misfit — New Fits, Forgettable Data (12 unique new recordings). Exact upload duplicates omitted. Existing retired demo attachments were not republished.
- GSix consumes the whole catalog, has a bundled fallback, and serves JSON with CORS. Its existing Tamagotchi companion continues using the one player and notifications.
- Both shared player and Survivor music panel show origin/release organization. The Survivor audio graph, mid-run transport and local IndexedDB stores are preserved.
- Metadata is cached for ten minutes. New releases append without interrupting playback. Two games' identically named releases keep separate disc shelves.
- Central sync command validates media existence and SHA-256 where supplied, and detects stale generated catalogs/player copies. Workflow prepares reviewable consumer PRs.

Verification:
- Shared player: 19 tests passed, including late release discovery, no audio creation before play, preserved playback time and outage retention.
- Survivor full suite: 1,225 passed before final additional shelf-collision test; final results recorded in the consumer handoff.
- Survivor typecheck and production builds passed.
- Shared package production TypeScript check and drop-in bundle build passed.
- Sync checker: zero stale mirrors.

Remaining:
- Review/merge/deploy source-game media first, then GSix catalog and player. Central source can merge before its consumers; distribution correctly rejects missing source-game media.
- Configure `LOK_MUSIC_SYNC_TOKEN` in central GitHub Actions for unattended cross-repo PR creation. No credentials were created or copied in this change.
- Browser binary download failed in this environment. Mobile visual behavior and actual Safari audio playback remain unverified.
- GSix full app build should run in CI: the private repository was read through GitHub, and the affected music package was reconstructed locally for targeted compilation/testing.
- Additional projects must register their releases centrally. The audited hub has no independent Tamagotchi soundtrack; companion effects stay effects. Foreign gated releases in Survivor need a future origin-progress adapter (fail closed currently).
