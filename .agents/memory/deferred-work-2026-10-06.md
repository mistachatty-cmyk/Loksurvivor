# Deferred work and follow-ups — 2026-10-06

Everything below was found while merging the leftover branches across the five repos
(`Loksurvivor`, `spend-ut-all`, `Lok-EcoSystsem`, `Gsixhub`, `G6-Games-Hub`) and shipping the
login and staff-security work. None of it is blocking. It is written down so a later session can pick
items up without re-deriving the analysis. Pick one item at a time and confirm with the user first.

## What was merged that day (for context)

- Gsixhub [PR 23](https://github.com/mistachatty-cmyk/Gsixhub/pull/23): login dialog and account menu portalled out of the header; staff tools (team and roles, announcements, audit log); `/admin` server gate; two Supabase migrations, applied to the live project.
- spend-ut-all [PR 20](https://github.com/mistachatty-cmyk/spend-ut-all/pull/20): Art District collecting system, ported from `feat/art-district-collecting`; the old PR 1 was closed as superseded.
- Loksurvivor [PR 223](https://github.com/mistachatty-cmyk/Loksurvivor/pull/223): Studio `dropClip` buffer-leak fix, shipped as 0.14.2.

## 1. Loksurvivor: old feature branches that could still be ported

`docs/PULLCHECK.md` already lists some old PR branches that are excluded from routine review; read it first. This table is a different cut: branches whose unique content is mostly **not** in `main` (an excluded branch is not an abandoned idea).

These are the branches whose content is mostly **not** in `main`. They are 250 to 370 commits behind and
conflict in 5 to 13 files each, so they cannot be merged. They can only be **ported by hand** onto today's
code, one feature at a time. Each needs a design check first: some overlap with systems `main` has since
rebuilt.

| Branch | Tip | Last commit | What it holds | Notes before porting |
|---|---|---|---|---|
| `claude/crypto-farm-collectibles-xmyn8p` | `ba8de4b` | 2026-09-06 | Crypto farm: passive Digital Essence generator, essence packs, collectible cast cards | Nothing like it in `main`; check it against the card/economy systems in `tcg-lokpet-crossover.md` |
| `claude/dash-block-physics-kom3p0` | `1c1b6b7` | 2026-09-05 | Dash through blocks, out-of-map yard, rolled launch multipliers, sealed props, null-alloy prefabs, held teleports | Not in `main`; touches obstacle kinds, so follow the "new `ObstacleDef` kind" checklist in `CLAUDE.md` |
| `claude/paint-gallery-custom-themes-w5gmv8` | `d9ac5cf` | 2026-09-03 | Independent per-character Paint Gallery skins | Not in `main`; overlaps with the customization/Lookbook work, so reconcile first |
| `claude/achievements-checklists-skins-838rnd` | `7ac0c3d` | 2026-09-13 | Reveal-on-visible catch-up counters for lifetime stats, checklists and skins | The "Apple sign-in coming soon" commit on it is **wrong for today**: `main`'s changelog says Apple sign-in works. Skip it |
| `codex/lookbook-studio` | `37a39b7` | 2026-09-01 | Portable Lookbook customization studio | `main` already has Lookbook files; likely partly superseded, diff before porting |
| `claude/pet-stacking-team-nzb56p` | `3e76b12` | 2026-08-31 | Pet Whisperer unlock: permanent LokPet roster, run teams, elixir revival | Already triaged in `docs/PULLCHECK.md` (PR 48, do not merge); a compatible rebuild is tracked by [issue 92](https://github.com/mistachatty-cmyk/Loksurvivor/issues/92). Overlaps LokPet and bond work in `main` (0.11.0 Bond and Growth) |
| `claude/game-ui-streamline-4l8chm` | `55359f4` | 2026-08-30 | Compact HUD strip and drawer, world shows through the HUD | `main` has had several HUD passes since; may be superseded |
| `claude/collapsible-ui-notification-toggle-w395ht` | `e0dde63` | 2026-08-30 | Fully collapsible run HUD and a notifications toggle | Same as above |
| `claude/ui-batteries-hideout-actions-521o7x` | `be8dee0` | 2026-08-29 | Sanctum ambient windows and crew activities | Check against `crew-feature.md` and `hideout-ambiance.md` |
| `claude/overview-optimization-check-khtr44` | `457b132` | 2026-09-03 | Rendering and collision optimization, floodwall-surge knockback fix | Performance work was redone in `swarm-performance-2026-09-12.md`; the knockback fix may still be worth lifting on its own |
| `claude/loksurvivor-run-modifiers-srxlkv` | `ba05ec2` | 2026-09-06 | Mirror Ball Cartel disco faction, area and boss | Check `data/factions.ts` and `data/areas.ts` for a faction with the same niche before authoring |
| `codex/studio-project-browser-72` | `af0d7bb` | 2026-09-09 | Local Studio project browser, persisted Studio projects and audio | Already triaged in `docs/PULLCHECK.md` (PR 73, do not merge); a fresh implementation is tracked by [issue 72](https://github.com/mistachatty-cmyk/Loksurvivor/issues/72). 13 conflicts; the Studio has changed a lot since (see `studio-engine.md`) |
| `claude/kinetic-bender-phase4-pause-ui-time-t5u1oa`, `-shop-gems-1qqa47`, `-progression-3ubvx6` | `648169a`, `e5d6a15`, `a953053` | 2026-08-29/30 | Early Kinetic Bender: Time Stop, Kinetic Throw, shop tiers, gem drops | `main` already has Kinetic content (32 files); treat as reference only, probably already delivered another way |

**How to re-check a branch against `main` before investing time** (run in a full clone; a shallow clone gives
wrong "ahead" counts and "no merge base"):

```bash
git fetch --unshallow origin            # only if the clone is shallow
git log origin/main..origin/<branch> --format='%h %cs %s'      # its unique commits
git merge-tree --write-tree --name-only origin/main origin/<branch> | grep -c '^CONFLICT'
# is a commit already in main, even under a different hash?
git show --format= <commit> | git apply --check -R             # clean = already applied
```

The GitHub `merged` flag from the PR list tool was `false` for every PR, so it cannot be used to tell what shipped.

## 2. Loksurvivor: branch cleanup (nothing was deleted)

- 156 remote refs exist. After full history was fetched, 93 branches were still "ahead" of `main`, almost all of them only because `main` took their work through squash merges (85 to 97 percent of their added lines are already in `main`).
- A branch is safe to delete once it is either (a) 0 commits ahead of `main`, or (b) its added lines are already in `main` and it is not in the section 1 table. Ask the user before deleting anything; deletion cannot be undone from here.
- `claude/argos-test` is a throwaway test branch and can go.

## 3. Loksurvivor: two tests already failing on `main`

`pnpm test` in `artifacts/survivor-616` reports 685 pass and 2 fail, on untouched `main` as well:

- `version ten Lookbook-era saves migrate without carrying portable customization data`
- `old saves cannot retain enabled Dev Mode without completing the new access gate`

Both expect 22 and get 25. Most likely a count of default-owned or default-unlocked items that grew when content was added, so either the expected number in the tests is stale or something is being granted by default that should not be. Decide which before changing the number.

## 4. spend-ut-all

- **Cloudflare Workers builds fail on every PR**: `Workers Builds: spend-ut-all` and `Workers Builds: spend-it-all-preview`. They fail within the same second they start, which points to the build configuration in the Cloudflare dashboard (they have been red since 2026-09-21), not the code. GitHub Actions `verify` and `validate` pass.
- **Leftover branches** (all reviewed, none needed): `codex/international-diplomacy-economy`, `codex/shared-game-login`, `codex/visual-style-switch-first`, `codex/tighten-play-kit-ui`, `codex/test-secondary-religion-system` are byte-for-byte already in `main`. `codex/world-atlas-*`, `claude/forbes-list-addon-jrnkzx`, `codex/merge-secondary-spend-it-all`, `codex/secondary-compatible-merge`, `codex/test-secondary-faith*`, `claude/spend-it-all-card-system-79suwk` and `claude/spin-it-all-lock-pads-hlcjnv` are superseded by later versions in `main`. All can be deleted when the user agrees.
- **Art District follow-ups** (built as a stub-sized first pass): it uses real National Gallery image URLs through `next/image` with `unoptimized: true`, so there is no image caching; the market value only changes weekly; the "Curator Circle" invitation is shown but unlocks nothing yet; display slots are `houseLevel + 1`. The dev overlay's hydration warning on first load also happens on `main` and has not been investigated.

## 5. Lok-EcoSystsem

`codex/spend-it-all-bootstrap` (plus `-review`, `-pr`, `-final`, `-2`, which are the same three commits) holds an early 400-line Next prototype of Spend It All under `spend-it-all/`. Its draft PR 1 was closed unmerged, and the real game lives in the `spend-ut-all` repo. Left unmerged on purpose. Safe to delete with the user's say-so.

## 6. Gsixhub and Supabase follow-ups

Project: `LokServices` (`jfavkudihasswkhkouxq`). Staff security is documented in `apps/hub/STUDIO_ACCESS.md` in Gsixhub.

- **Dashboard settings (no code):** turn on MFA for admin and owner accounts, and turn on leaked-password protection.
- **Security advisor findings that were already there** (not caused by the staff-security work):
  - `public.send_loks`, `redeem_guest_pass`, `lokdex_public`, `rls_auto_enable` and `send_welcome_email_webhook` are `SECURITY DEFINER` and executable by the anonymous role. `lokdex_public` and `redeem_guest_pass` may be intentionally public; `send_loks`, `rls_auto_enable` and `send_welcome_email_webhook` almost certainly should not be callable by anonymous visitors. Check each function's own checks, then revoke execute where it is not needed.
  - `claim_reward`, `lok_equip`, `lok_profile`, `send_loks`, `rls_auto_enable`, `send_welcome_email_webhook` are callable by signed-in users; same review.
  - `stripe.set_updated_at`, `stripe.set_updated_at_metadata`, `stripe.check_rate_limit`, `public.check_bleep_rate_limit` and `public.send_loks` have no fixed `search_path`.
  - `lok_bleep_rate_limit`, `lok_earn_rules` and `lok_tenants` have row-level security on with no policies (probably intended: server-only tables).
- **Known limits of the staff work:** the shared `.gsix.online` session cookie is written by JavaScript so it cannot be HttpOnly; the `/admin` server gate protects pages while the database protects data. No full Content-Security-Policy yet (ads and embedded games need an allow-list); `frame-ancestors 'none'` is already set on `/admin`. No per-user upload count cap, only the 50 MB per-file limit.
- **A column added to `lok_profiles` later needs its own grant:** `grant update (new_column) on public.lok_profiles to authenticated`. The role-lock migration granted update on the existing columns only, so a new column is read-only to signed-in users until granted.
- **Migration tooling quirk:** the Supabase tool timed out on SQL that used `$$` function bodies and on larger multi-statement batches. The live functions were created with single-quoted bodies instead (same logic). The repo files `20261006000000_gsix_staff_security.sql` and `20261006000100_gsix_announcements_hardening.sql` are the readable versions; the two versions were also recorded by hand in `supabase_migrations.schema_migrations`. If this project is ever rebuilt from the repo files they work as written.
- **Test scripts:** `supabase/tests/staff_security.sql` and `staff_security_paths.sql` passed on a local Postgres 16 with stub schemas. They were not run against the live database.
