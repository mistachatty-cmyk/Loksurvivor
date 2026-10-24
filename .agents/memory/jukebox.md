# Jukebox Room (2026-10-22)

Spec and handoff log: `docs/jukebox-spec.md`. Shared logic: `packages/lok-jukebox` (`@lok/jukebox`).

- Theater levels: L1 UI full + dampen 3.5 for 4 s after a touch, L2 UI 0.35 + dampen 1.5 for 20 s, L3 UI hidden + dampen 0 until touched. Rules live only in `theater.js`.
- Dampen filters sit AFTER the analyser (`setTheaterTone` in `musicPlayer.tsx`). Never move them before it: beat detection and the room's color grade must see the true sound. Never add a second AnalyserNode; read `beatBus`.
- First touch at L3 only wakes the room (capture-phase swallow in `JukeboxRoom.tsx`).
- Unlock: `arcade-box` discovery, granted only when `arcade-high-score` is already known. The Arcade Box spawns every Neon Arcade run. `?jukebox` previews the room in any build.
- The id `pulse-jukebox` is a hideout prop that opens the Soundtrack panel; the room is `jukebox-room`. Do not merge them.
- Discs are procedural (`jukeboxDiscs.ts`); locked tracks show as sealed discs. No artist or licensing text on discs.
- Opt-in arrival discs: Settings row, flag `survivor616.arrival-discs.v1`.
- Performance rule (2026-10-22): the room's grade writes opacity onto two small layers (refs, ~12 fps). No filters and no per-frame CSS variables on an ancestor of the discs; swiping only browses. See `mobile-stability-2026-10-22.md`.
- Shelves, spin and pull-out (0.42.37): `ui/DiscShelves.tsx` is the one place both the Jukebox Room and the arrival screen draw discs. Songs are grouped into shelves by `Track.album` (`game/audio/jukeboxShelves.ts`, pure); a new bundled album is a new shelf with no code change, and songs without a hand-made Lokifed style get a disc generated from the song id. Only the active shelf's carousel is mounted (memory). Settings: `survivor616.jukebox.shelves.v1` and `.disc-gestures.v1` (default on); off gives the old single tap-only row.
- Gestures: a press is classified in the capture phase. Mostly-vertical drag on the centered disc = pull-out; mostly-vertical elsewhere = shelf swipe; both are hidden from the carousel so finger drift cannot also scroll the row. The end is caught on the window. The wrapper carries `data-no-swipe` so browsing never triggers the page-to-page dock swipe. Hand-spin writes only `--dcc-user-spin` on the chosen disc's own `.dcc-roll` (added to `--dcc-roll` in the carousel CSS); never a per-frame variable on an ancestor. `DiscPullOut` renders in a portal. Hand-spin physics are pure in `lib/discSpin.ts`.
- Ideas not built: scratch/playback-rate effect on the spinning disc (touches the audio graph, so needs its own design), user playlists as shelves, per-shelf unlock art.
