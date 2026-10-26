# LokServices security audit, 2026-10-26

Read-only audit of the live project (`jfavkudihasswkhkouxq`) after the ChatGPT handoff. Applied changes are in
`supabase/migrations/20261026_lok_hardening_baseline.sql`. Nothing below was changed unless it says APPLIED.

## Verified and APPLIED
- `auth_saves` policy: owner-only and non-anonymous, in both USING and WITH CHECK (re-read from `pg_policies`). LOKS Queens N Kings
  only writes cloud saves for permanent accounts, so it is compatible; guests stay on-device.
- Search path fixed on the seven functions in the handoff (confirmed).
- NEW: EXECUTE revoked from `public`, `anon`, `authenticated` on the trigger functions `rls_auto_enable()` and
  `send_welcome_email_webhook()` (database-run only, nothing calls them through the API).
- NEW: friend DM table + `lok_dm_open` (friends only, authenticated only).

## Found, NOT changed (needs caller mapping first)
1. **`lok_accounts_legacy_lokbook`**: anon can SELECT, INSERT and UPDATE every row, and the table has `pin_hash` and `save_blob`.
   Anyone with the public key can read every PIN hash and overwrite any account. Highest risk. Fix path: move LokBook login to
   Supabase Auth (or a function that checks the PIN server-side), then drop the anon policies. Needs the LokBook client.
2. **Drawing/party tables** (`lok_rooms`, `lok_room_members`, `lok_room_strokes`, `lok_journals`, `lok_stamps`, `lok_posts`):
   public read, insert and update with `true`. `lok_room_strokes` also allows public DELETE. Scope writes to `owner_id =
   auth.uid()` once those clients sign in.
3. **`lok_battles`, `lok_bookmarks`, `lok_follows`, `lok_reactions`**: anon insert/delete with `true`; identity is a plain
   `handle` text, so anyone can act as anyone. Leaderboard reads can stay public.
4. **`send_loks`**: authenticates with `auth.uid()` and caps at 500/day, but the parameter `amount` shares a name with the
   column `lok_transfers.amount` inside `SUM(amount)`. PL/pgSQL will report an ambiguous reference when the daily-cap query runs.
   Fix by qualifying the column (`SUM(t.amount)`) and adding a test. It is still executable by `anon` (it returns "Sign in").
   It also never checks that the recipient is a real account.
5. **`send_welcome_email_webhook`** has a webhook secret written into its body. Rotate it (edge function secret + the
   function) and read it from Vault or a setting instead.
6. Anon-executable SECURITY DEFINER RPCs that look intentional but deserve review: `gsix_playtime_add`,
   `gsix_playtime_add_guest`, `lok_crash_report_add`, `redeem_guest_pass` (returns a save by code, so codes need to be long and
   random), the `pf_*` Pongfall functions (guest tokens), and the public profile readers.
7. RLS on with no policy (likely intentional, confirm each): `gsix_playtime_apps`, `lok_bleep_rate_limit`,
   `lok_crash_reports`, `lok_dm_threads`, `lok_earn_rules`, `lok_tenants`.

## Not done
- No end-to-end test of guest to account upgrade across games.
- Per-game parity matrix (login providers, guest, saves, friends) was not built.
- Auth dashboard settings (redirect URLs, anonymous sign-ins, manual linking) are dashboard-only.
