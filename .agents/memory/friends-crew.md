# Friends, crew and listening together (0.42.51)

Full write-up: `docs/LOK_FRIENDS.md`. Decisions worth keeping:

- "Crew" in the UI means the friend group (up to 4 players). The existing ally "crew" (rescued allies, `crew-feature.md`) is a different thing, so every internal id here is `social`/`friends`/`listen`, never `crew*` for allies and never the reverse.
- Writes go only through the `lok_*` security-definer functions in `supabase/migrations/20261025_lok_friends_crew.sql`; tables are read-only under RLS. The migration was tested against a local Postgres (pglite) with stubbed `auth` before it was written to the repo. It is NOT applied to the shared project until Eric approves; the overlay shows "almost ready" while the functions are missing (`missing()` in socialStore matches the PostgREST error).
- Pictures render only from provider hosts (`safeAvatarUrl`); names prefer the username, then full name, then the email part. `slimSession` in lok-client now keeps `user_name`/`preferred_username` so Discord/GitHub names survive the cookie size cap.
- Presence = Realtime presence on `lok-presence`, never stored. Connect only when signed in + `friendsPref` on; drop after the page is hidden 60s. Players who hide their status are not tracked.
- Listen together: crew-id channel, one `listen` event with `kind` start/state/stop/join/leave. Host changes are explicit; heartbeats (every 8s) only correct drift and never start or stop a follower's music. Logic lives in `lib/social/listenSync.ts` (tested); `state/listenTogether.tsx` only wires it to the player. Locked or local songs cannot be followed.
- QR codes are made on device with `qrcode-generator` (no network); the code encodes `https://survivor.gsix.online/?friend=CODE`, which opens the Add tab with the code filled in. There is no in-app scanner; the phone camera is the scanner.
- Headless check pattern for signed-in UI: build with `VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=x`, put a fake session in localStorage key `sb-localhost-auth-token`, mock `**/rest/v1/rpc/*` with Playwright routes, then dispatch `lok:open-crew`. Realtime sockets fail silently, so presence stays empty.
