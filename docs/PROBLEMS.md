# Problems and bugs

Known issues, stale facts and parked work. Add a line when you find one; move it to Fixed with the version when it ships. Reviewed 2026-10-07 at v0.19.1.

## Open

| # | Area | Problem | Notes |
|---|---|---|---|
| 1 | Docs | `CLAUDE.md` said the test suite had ~174 cases; it now has 776 | Fixed in the same change as this file |
| 2 | Package | `artifacts/survivor-616/package.json` still reads `0.7.0`; the game is at `0.19.x` | Cosmetic; the changelog is the real version |
| 3 | Hideout UI | `HubScreen.tsx` is about 1,160 lines, mixing nav, rooms, scene links and room panels | Split per `docs/HIDEOUT-UI.md` |
| 4 | Hideout UI | Scene links on the main floor were hand-copied buttons (fixed in 0.19.1 for that panel). Other panels still repeat the pattern | One shared link-card component is the fix |
| 5 | Onboarding | No first-run tour of the hideout rooms, only the currency glossary | Open since 2026-09-28 |
| 6 | Settings | `SettingsPanel.tsx` is one long flat list | A redesign must keep Classic as an option |
| 7 | Currency help | Glossary tooltips need hover, which touch screens lack | Tap-to-reveal card exists; keep it the primary path |
| 8 | Tests | Some old e2e specs were parked in 0.10.5 | List and re-enable or delete |
| 9 | Economy | No income-versus-sink balance sheet | See `docs/ECONOMY.md` |
| 10 | Dev env | Fresh cloud sessions have no `node_modules`; typecheck fails with missing `node` and `vite/client` types until `pnpm install` | Run it first |
| 11 | Dev env | Vite may not use the requested `PORT`; read the port it prints | Seen on 2026-10-07 |

## Fixed

| Version | Problem |
|---|---|
| 0.19.1 | Hideout "Scene & Sanctum Links" stacked right-aligned buttons at ragged widths with a dead zone |

## Parked and intentionally excluded

Old PR branches that must not be merged are tracked in `docs/PULLCHECK.md`.
