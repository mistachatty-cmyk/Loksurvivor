# Lok friends, crew and listening together

One system for every Lok game. A player signs in once (Discord, GitHub, Google, Apple or email), gets a short friend code, adds friends, forms a crew of up to four, sees who is online and can listen to the soundtrack together. 616 Survivor is the reference implementation.

## Pieces

- `supabase/migrations/20261025_lok_friends_crew.sql`: tables and `lok_*` functions. Clients read through row-level security and write only through the functions. Apply it once to the shared Lok project (it is idempotent).
- `lib/lok-client/src/friends.ts`: typed client for those functions, plus `joinPresence` (who is online) and `openCrewChannel` (live messages inside one crew).
- `artifacts/survivor-616/src/state/socialStore.tsx`: provider (card, friends, recent players, crew, presence, subscriptions, `?friend=CODE` links).
- `artifacts/survivor-616/src/ui/CrewOverlay.tsx`: the button and the overlay. `PlayerAvatar` and `QrCode` are its small parts.
- `artifacts/survivor-616/src/state/listenTogether.tsx` and `src/lib/social/listenSync.ts`: listen together.

## Rules the code keeps

- Friend codes look like `LOK-7K2M-Q9XD` (no I, L, O, 0, 1). The database issues them; a new code can be made at any time and the old one stops working.
- A crew holds at most four players and a player is in one crew at a time. Only accepted friends can be invited. When the leader leaves, the longest-standing member leads.
- Online status is Realtime presence on the `lok-presence` channel. Nothing about it is stored. A player who turns "Show me as online" off is not tracked at all, and the client also ignores presence for anyone whose card says they hide.
- Profile pictures are shown only from the sign-in providers' own image hosts (`src/lib/social/identity.ts`). A card is displayed on other players' screens, so an arbitrary URL is never loaded.
- The live connection opens only when signed in, only while "Friends and crew" is on in Settings > Power, storage and data, and closes after the page has been hidden for a minute.
- Listening together sends a song id, a play/pause flag and a position, never audio. Only soundtrack songs (the same in every game) can be shared. The crew channel is named after the crew's random id, which only crew members ever receive.

## Crew chat, emotes and crew runs (0.42.53)

- **One shared crew channel.** `socialStore` opens `lok-crew-<crewId>` once, only while the crew has two or more players, and exposes it as `social.bus` (`send`, `on`, `up`). Listening together and chat both ride it; never open a second channel with the same name.
- **Chat and emotes** (`src/lib/social/crewChat.ts`, `state/crewChat.tsx`, `ui/CrewChat.tsx`): lines up to 120 characters, four per eight seconds, checked again on receipt, kept in memory only. Emotes are a fixed list. Crewmates' lines show as small pop-ups over any screen, including runs. Settings > Power has a "Crew chat" switch.
- **Crew runs** (drop in / drop out): a crewmate opens an open room from the Crew overlay. While hosting, presence carries `doing: 'run'` plus `room: <crewId>`; other crew members see the "your crew is in a run" prompt (`ui/CrewRunSetup.tsx`) and can drop in. The room is a Realtime broadcast channel `crewrun:<crewId>` (`game/arena/crewRunNet.ts`), same relay idea as the arena: the host relays move inputs, the shared clock and kill counts at about 7 messages a second, and every device runs its own simulation from a shared seed. A late joiner copies the host's clock so the waves line up.
- **What a crew run is not.** Joined players are the arena's lightweight helpers (they move and strike nearby enemies, no levelling), only the host can be knocked out, and if the host leaves the run ends for everyone. Enemy swarms can drift a little between screens. Scores are unranked and pay nothing.
- **Walking loading screen** (`ui/WalkingLoader.tsx`): shown while the room connects. A canvas street the player's own operator walks along; chips, bounce pads and pigeons are for play only and nothing is saved.
- **Playlists on the account** (`lib/playlistSync.ts`, `ui/PlaylistCloudSync.tsx`): custom playlists are stored under their own key in the player's `auth_saves` row (`survivor616.playlists`). Only names, order and bundled songs are saved. Newest edit wins; a device that has never synced merges instead. Settings > Power has a switch.

## Switching it on (dashboard steps, once)

1. Supabase > Authentication > Providers: enable Discord and GitHub (each needs a client id and secret from its developer portal; the callback is `https://<project>.supabase.co/auth/v1/callback`). Google and Apple are already used by the game.
2. Authentication > URL configuration: add `https://survivor.gsix.online` (and any other Lok game's address) to the redirect allow-list.
3. Apply the migration (SQL editor, or the Supabase MCP `apply_migration`).
4. Make sure Vercel has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the game project.

Until step 3 the overlay says friends are almost ready instead of failing.

## Free-tier note

Realtime free tier allows 200 concurrent connections. Each signed-in player with the page open uses one for presence (plus one while in a crew with company, plus one in a crew run). The free tier also limits messages per second across the whole project, which is why crew runs send about 7 ticks a second and guests only send input when it changes. That is plenty for now; the connection-closing rules above exist to keep it that way.

## Keeping the free tier safe (0.42.54)

- The crew channel opens only when `wantBus` is true: crew exists, page awake (hidden for 60s closes it), and a crewmate is online or something holds it. The Crew overlay, a crew run and listen-together each `hold()` the bus while active.
- Every send goes through a token bucket (`createBudget` in `lib/social/netConfig.ts`, 8/s with a burst of 16). Chat allows 4 lines per 8 seconds plus `chatPerMinute`. Crew runs tick at `runTickHz` (default 4) and the host skips ticks that match the last one unless a second has passed.
- `public/lok-net.json` is a remote dial read once per session: set `presence`, `chat`, `listen` or `crewRuns` to `false`, or lower `chatPerMinute` / `runTickHz`, and redeploy to shed load without a code change. Defaults apply if the file is missing.
- Players who hide their online status only receive chat while they have the Crew overlay or a run open.
- Members can be muted per device (`survivor616.crew.muted.v1`).
