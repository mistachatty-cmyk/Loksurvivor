# Friends, crew and listening together (0.42.51)

Full write-up: `docs/LOK_FRIENDS.md`. Decisions worth keeping:

- "Crew" in the UI means the friend group (up to 4 players). The existing ally "crew" (rescued allies, `crew-feature.md`) is a different thing, so every internal id here is `social`/`friends`/`listen`, never `crew*` for allies and never the reverse.
- Writes go only through the `lok_*` security-definer functions in `supabase/migrations/20261025_lok_friends_crew.sql`; tables are read-only under RLS. The migration was tested against a local Postgres (pglite) with stubbed `auth` before it was written to the repo. It is NOT applied to the shared project until Eric approves; the overlay shows "almost ready" while the functions are missing (`missing()` in socialStore matches the PostgREST error).
- Pictures render only from provider hosts (`safeAvatarUrl`); names prefer the username, then full name, then the email part. `slimSession` in lok-client now keeps `user_name`/`preferred_username` so Discord/GitHub names survive the cookie size cap.
- Presence = Realtime presence on `lok-presence`, never stored. Connect only when signed in + `friendsPref` on; drop after the page is hidden 60s. Players who hide their status are not tracked.
- Listen together: crew-id channel, one `listen` event with `kind` start/state/stop/join/leave. Host changes are explicit; heartbeats (every 8s) only correct drift and never start or stop a follower's music. Logic lives in `lib/social/listenSync.ts` (tested); `state/listenTogether.tsx` only wires it to the player. Locked or local songs cannot be followed.
- QR codes are made on device with `qrcode-generator` (no network); the code encodes `https://survivor.gsix.online/?friend=CODE`, which opens the Add tab with the code filled in. There is no in-app scanner; the phone camera is the scanner.
- Headless check pattern for signed-in UI: build with `VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=x`, put a fake session in localStorage key `sb-localhost-auth-token`, mock `**/rest/v1/rpc/*` with Playwright routes, then dispatch `lok:open-crew`. Realtime sockets fail silently, so presence stays empty.

## Crew chat, crew runs, playlists (0.42.53)

- Crew channel is shared: `social.bus` in socialStore. Listen-together and chat subscribe with `bus.on(event, handler)`; do not call `openCrewChannel` anywhere else.
- Crew run = arena relay made drop-in/out. Rules in `lib/social/crewRun.ts` (seats p2-p4, 8s silence drops a seat, `openCrewRun` finds a crewmate whose presence has `doing:'run'` and `room === crewId`). Networking `game/arena/crewRunNet.ts` (tested with an in-memory hub), world helpers `game/arena/crewRunWorld.ts`, screen `game/CrewRunScreen.tsx`. `removeGuestPlayer` in world.ts. Guests are lightweight; host falling ends the run.
- The crew-run screen announces presence itself (it knows if it is hosting); `CrewPresenceSync` in App returns early for `crew-run`. Leaving resets to `menu`.
- Message budget: Realtime free tier limits messages per second for the whole project. Host ticks ~7/s only while guests exist; guests send input on change plus a 1.5s heartbeat. Keep it that way.
- Playwright can mock the Realtime socket with `page.routeWebSocket` (reply `phx_reply` ok to every message, push `presence_state` for the prompt). Broadcast sends are binary frames and are not visible to the mock.
- Playlists sync under `auth_saves` key `survivor616.playlists`; the edit stamp lives in localStorage `survivor616.playlists.v1.stamp`.

## Net budget and loading game (0.42.54)

- Crew channel is need-based (`wantBus`, `bus.hold()`); all sends go through token buckets; remote dial `public/lok-net.json` (`netConfig.ts`). Any new realtime feature must hold the bus while active and respect `useNetConfig()` flags. Details in docs/LOK_FRIENDS.md.
- Host crew-run ticks default to 4 Hz and skip unchanged ticks; do not raise without checking the message budget.
- Loading game: `lib/climbGame.ts` (pure, tested) + `ui/ClimbLoader.tsx` (canvas, uses equipped operator look and starter/selected LokPet). `ui/LoadingGame.tsx` picks climb vs walk by `climbLoaderPref`; App's Suspense fallback shows `DelayedLoadingGame` for run screens. Saved test pet must be injected into a real meta object (a bare seed gets reset by the store).
- Avoid the word "signal" even for AbortController; use Promise.race timeouts.
