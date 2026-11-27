# Lok Couch Connect: TV party play, QR join, drop in and drop out

Status: plan only (nothing here is built yet). Goal: Lok Party and every future Lok game can run like a Netflix or Jackbox party game: one big screen shows the game, phones are the controllers, anyone can walk in or out mid-game.

## What already exists we reuse
- `src/ui/QrCode.tsx` (qrcode-generator, offline, no cost) for join codes.
- Friend codes, crews, presence and the broadcast relay in `docs/LOK_FRIENDS.md`, including drop in / drop out crew runs and the token-bucket send budget (`lib/social/netConfig.ts`).
- `lib/lokInput` one action layer (dir, primary, secondary, tertiary, quaternary, num). A phone controller just produces the same actions, so no game changes.
- Minigame cartridges (`docs/LOK_MINIGAME_CARTRIDGE.md`) with seeded sims: every screen can simulate the same game from a seed.
- Game Mode (in-app fullscreen) and the Xbox/TV render governor.

## The package: `@lok/couch` (new, pure, liftable to its own repo)
Same rule as lokInput: it imports nothing from any game. Games talk to it through three things.
1. **Room**: `createRoom()` returns a short code (4 letters, no look-alikes) and a join URL. `joinRoom(code)`. Max 8 seats, up to 4 playing and the rest queued or watching.
2. **Seats and presence**: `seat.join / leave / reconnect`. A leaver is replaced by a bot at the skill they were playing at. A joiner takes the next open seat at the next safe moment (between minigames, or a catch-up spot mid-board).
3. **Input channel**: controller phones send lokInput actions (not raw touches), capped by a send budget. The host screen is the only simulator; phones are dumb pads. Late latency is hidden by buffering actions (the existing InputBuffer and Coyote helpers).

## Flows
- **TV host**: Game Mode on, big lobby with a large QR and the room code, player avatars pop in as phones join, ready-up ring, then the board. Large type, safe-area margins, focus never lost (no tab-stops needed).
- **Phone join**: scan the QR, no sign-in needed (guest name plus pick a character), land on a controller page that shows only the buttons the current minigame needs, with haptics and pop feedback.
- **Drop in**: a new phone joins as a spectator with a cheer button, then takes a seat at the next gap.
- **Drop out**: a bot takes over smoothly, no pause. If the host leaves, the room hands off to the longest-seated phone that can host, or ends cleanly.
- **Reconnect**: the same device returns to its seat by a private token for 60 seconds.

## TV quality of life (Netflix-style)
- Everything reachable with a gamepad or remote arrows; visible focus ring; B always backs out.
- One-line "how to play" card per minigame, 2 second readable.
- Never an unskippable wait: lobby music, mini-warmup toss, skip-able recaps.
- Audio ducking, subtitles for spoken lines, colorblind-safe team colors, reduced-motion toggle.
- Big, calm results card with a replay-in-one-press button.

## Backend and cost
- Needs a realtime channel per room (Supabase Realtime broadcast, same as crew runs). Costs stay low: host-authoritative sim, phones send changes only, about 4 to 7 messages a second per player, and the `lok-net.json` dial can shed load. Rooms hold no stored data.
- Needs notes in docs for anything stored: leaderboards per room and guest-to-account linking are later and need a backend table.

## Build order
1. Room code + join URL + QR lobby on the host (no phones yet, bots only).
2. Phone controller page (static, lokInput actions) over the existing broadcast relay.
3. Seat swap with bots on leave, joins between minigames.
4. Spectator cheers, reconnect token, host hand-off.
5. Extract `@lok/couch` into its own repo with the SDK sync flow used for `lok-universe`.

## Planning doctrine for the Lok ecosystem (proposed)
Every new feature gets a one-page plan before building, in `docs/`, with these headings: Goal, What already exists, Pieces, Flows, Cost and backend notes, Build order, What is not built. Plans say plainly what is built and what is not. Anything liftable gets an isolation test. Anything needing a backend is noted in the repo docs. Anything new for players gets a changelog entry. No emoji, procedural art, no new runtime cost without a reason.
