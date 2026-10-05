# LokTokens economy integration (2026-09-27)

616 Survivor now earns and displays "LokTokens" from the shared cross-app
Lok economy — a real, already-provisioned Supabase project ("LokServices",
id `jfavkudihasswkhkouxq`, org `ddbicwwmddhlptfdiszr`), not new
infrastructure invented for this repo. This is the **first app in the
ecosystem to actually integrate** with the economy: 616 Survivor was
already registered in `lok_apps` (`app_key: 'survivor616'`) and sibling
apps (LokLingu, LokBook, Runesite, LokGarage, GSix) already had
`lok_earn_rules` configured, but a repo-wide and GitHub-org-wide code
search for `lok_grant`/`lok-earn` found zero prior client integrations
anywhere — nobody had wired the client side up before this pass.

## The one hard constraint that shapes everything

`lok_grant` and `lok_bootstrap_account` (the only functions that award
tokens or create an account row) are `SECURITY DEFINER` but `EXECUTE` is
granted only to `postgres`/`service_role` — **not** `authenticated`. A
browser client can never call them directly with a user's JWT. Only
`lok_profile` (read-only balance/rank) is grantable to `authenticated`.
This is why earning requires a server-side hop and why the whole design
below exists.

## What was built (reusable for every future Lok app, not survivor-616-specific)

- **`lok-earn` edge function**, deployed on the shared `LokServices`
  project (`verify_jwt: true`). Verifies the caller's session itself via
  `userClient.auth.getUser()` — never trusts a client-supplied account id
  — then calls `lok_bootstrap_account` + `lok_grant` with the service role
  key. Any Lok app calls this same endpoint with its own `appKey`/
  `eventKey`. **`trusted` is always forced to `false`** inside the
  function regardless of what the request body sends — this function can
  only prove "a signed-in user made this HTTP request," never that the
  claimed game event actually happened, so it must never be able to
  satisfy a `server_only` earn rule. Only a future integration that
  actually validates the event server-side should ever set `trusted: true`.
- **`lib/lok-client/src/economy.ts`** — `earnLokTokens()` (calls the edge
  function) and `getLokProfile()` (wraps the `lok_profile` RPC directly,
  no edge function needed for reads). Exported from the package's
  `index.ts` alongside the existing `auth`/`saves`/`waitlist`/`feedback`
  modules — this is the piece every other Lok app should import too,
  rather than re-deriving its own copy.
- **`survivor616`'s `lok_earn_rules`** (new rows, this app's `app_id =
  8999aa42-ca18-4af3-85ee-5e88e20b688a`): `run_complete` (15, daily cap 15,
  cooldown 20s), `area_cleared` (40, cap 10), `boss_kill` (60, cap 10),
  `arena_match_win` (50, cap 10 — ties LokSurvivorArena into the same
  economy), `daily_login` (25, cap 1). All `server_only: false` — client-
  reported and trusted the same way every sibling app's rules already are;
  there is no cheat-detection layer anywhere in this ecosystem today, and
  this integration doesn't change that pre-existing property.
- **`src/state/lokEconomyStore.tsx`** — `LokEconomyProvider`/
  `useLokEconomy()`, nested inside `AuthProvider` (needs `session`) in
  `App.tsx`'s `Providers`. Exposes `balance`/`lifetimeEarned`/`rank` (read
  once per sign-in) and a fire-and-forget `earn(eventKey, ref?)`. Every
  call is a no-op when `lokClient` is undefined or nobody's signed in —
  earning tokens must never block or error out gameplay, mirroring the
  gating pattern `authStore.tsx`/`cloudSyncStore.tsx` already use.
- **Call sites**: `App.tsx`'s `handleFinish` (run end) for
  `run_complete`/`area_cleared` (`result.cleared`)/`boss_kill` (checked via
  `killsByEnemy` against `getEnemy(id).family === 'Boss'`, since
  `RunResult` has no separate boss-kill flag); `goHub()` for
  `daily_login`; `ArenaScreen.tsx`'s `ended` transition for
  `arena_match_win` — **only when the winning standings entry's id is
  `'host'`**, since arena guests are local-only actors sharing one device,
  not separate Supabase-authenticated users, so only the signed-in host's
  own win can ever earn.
- **UI**: a LokTokens badge in `HubScreen.tsx`'s header (next to the
  existing cred/loot-tokens/skeleton-keys readout), shown only when
  `session && lokBalance !== null`, clicking through to the existing
  `'account'` screen. `AccountPanel.tsx` gained a `LokBalanceSection`
  inside the signed-in card, showing balance/lifetime-earned/rank.

## What is fundamentally NOT the same thing

`cred` (`game/state/metaStore.tsx`) is a wholly separate, local-only,
non-networked soft currency — mutated by pure reducer arithmetic,
persisted only to `localStorage`. It has no ledger, no idempotency, no
cross-app account tie-in, and no server-side source of truth. Do not
conflate it with LokTokens or try to merge/convert between them.

## Fully verified end-to-end (2026-09-27 follow-up)

An earlier pass here concluded Supabase Auth email delivery was broken.
That was wrong — it was a self-inflicted test mistake: the throwaway test
account used `@example.com`, a reserved, non-routable documentation-only
domain (RFC 2606) that no real mail server exists for, so any real
provider correctly bounces mail to it. Real signups work fine — the
project's `auth_logs` show real users signing in via Google OAuth from
`gsix.online`/`survivor.gsix.online` throughout, and a retry with a real
(disposable-inbox) test domain returned a clean `200` with
`confirmation_sent_at` populated.

With that corrected, the full live path was verified for real: signed up
a test account, confirmed it server-side (simulating the email-link
click), signed in for a real JWT, then called `lok-earn` three ways —
a real grant (`{"ok":true,"amount":15,"balance":15,"lifetime":15}`), a
replay of the same `idemKey` (`{"ok":true,"replay":true,"balance":15}`,
correctly not double-crediting), and an unknown `eventKey`
(`{"ok":false,"error":"unknown_event"}`, clean rejection) — then confirmed
`lok_profile` returns matching balance/rank data. All test data (ledger
row, account row, auth user) was deleted afterward.

**Separate, real, pre-existing issue found while investigating:** the
`send-welcome-email` edge function (not part of this integration, created
long before it) returns `500` on every signup, including real ones
unrelated to this change (confirmed in `function_edge_logs`, e.g. a real
2026-09-26 signup). Worth a follow-up look by whoever owns that flow —
it isn't something `lok-earn`/this integration touches or caused.

## 0.11.4 follow-up: new earn events (client wired, server rules NOT yet added)

`ArchivePanel.tsx` now calls `earn()` for `achievement_claimed` (ref =
achievement id), `card_exchange_sent` (ref = kennel pet id) and
`card_exchange_received` (ref = visiting card `instanceId`). The idemKey is
derived from those refs, so each thing pays at most once. **These event keys
have no `lok_earn_rules` rows yet** -- until someone inserts them for app
`8999aa42-ca18-4af3-85ee-5e88e20b688a`, `lok-earn` answers `unknown_event`
and nothing is granted (harmless, gameplay never blocks). Suggested values:
achievement_claimed 10 (daily cap 50), card_exchange_sent 15 (cap 30),
card_exchange_received 15 (cap 30). Applying them touches the shared
production project, so it was deliberately left for the owner to approve.
