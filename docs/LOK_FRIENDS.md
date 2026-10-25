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

## Switching it on (dashboard steps, once)

1. Supabase > Authentication > Providers: enable Discord and GitHub (each needs a client id and secret from its developer portal; the callback is `https://<project>.supabase.co/auth/v1/callback`). Google and Apple are already used by the game.
2. Authentication > URL configuration: add `https://survivor.gsix.online` (and any other Lok game's address) to the redirect allow-list.
3. Apply the migration (SQL editor, or the Supabase MCP `apply_migration`).
4. Make sure Vercel has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the game project.

Until step 3 the overlay says friends are almost ready instead of failing.

## Free-tier note

Realtime free tier allows 200 concurrent connections. Each signed-in player with the page open uses one for presence (plus one while in a crew with company). That is plenty for now; the connection-closing rules above exist to keep it that way.
