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
- Listening polish (0.42.38): the provider sets Media Session metadata, handlers and position (pure helpers in `lib/mediaSessionMeta.ts`; bundled songs are credited to "616 Survivor", local files get no artist, never invent one). `lib/useWakeLock.ts` keeps the screen on while the room or a pulled-out song plays (setting `survivor616.jukebox.keep-awake.v1`, default on). Room extras: shuffle, repeat, sleep timer (`lib/sleepTimer.ts`, lives only while the room is open) and keys (Space/N/P/S/R/F; letters work even after clicking a button, Space does not).
- Crash reports: `startCrashWatch` files the "Page closed unexpectedly" report on the NEXT visit, so it now temporarily sets the screen to the one stored by the dead visit (the vendored SDK reads `getScreen`; never edit it). CI (`.github/workflows/ci.yml`) typechecks, builds, then tests, so `buildPrivacy.test.ts` sees a real build.

## Power, storage and data (0.42.39)
- `src/lib/powerSaver.ts`: one saver (Off/Auto/On; Auto = battery <=20% not charging, or Data Saver). Read it via `useSavingPower()` / `isSavingPower()`; never add a second "low power" flag. It caps run frame rate (`effectiveFrameRate`), gates music-reactive glow, disc pulse, wake lock, and sets `<html data-power-save>` (CSS freezes ambient animations). Simulation and rewards are never touched.
- `src/lib/devicePref.ts` `createPref` is the pattern for new per-device switches. `storageUsage.ts` is read-only (no bulk delete: user files are referenced by playlists and Studio).
- Settings home for all of it: `PowerSettings.tsx` (id `settings-power`). Anything new that costs power or network gets a toggle there.

## Offscreen canvases (0.42.41)
- `useNearViewport` (src/lib/useNearViewport.ts) gates canvas drawing/animation by IntersectionObserver and frees backing stores offscreen. RigPortrait and SdkCanvasArt use it. Card shop binder went from 77 live 284px canvases (6.2 MP) to ~10 (0.8 MP). Use it for any new long grid of canvases.

## Two-tab save guard (0.42.43)
- `src/lib/saveGuard.ts`: a foreign `storage` write only flags the tab; the prompt (`SaveGuardBanner`) appears when this tab next tries to save (`saveMeta` -> `requestWrite()`). Prompting on the foreign write itself was noisy (opening a second tab always rewrites the save). Pref `tabGuardPref` (Power settings).

## Daily message (0.42.44)
- `public/lok-daily.json` (hand-edited, max 5 notes, dated windows, validated by `parseDailyFeed` and a test) is read by `lib/dailyFeed.ts` at most once per UTC day, shown once per note id as a hideout strip line. Blocked by pref, saver/Data Saver, offline. To announce something: add a note with `from`/`until`; no redeploy logic needed beyond shipping the file. Keep the network note in Settings (`settings.power.networkBody`) in step with any new network read.

## Challenge codes (0.42.45)
- `lib/challengeCode.ts`: `616.<area lowercased>.<seed base36>.<check>`; decoder matches ids case-insensitively (an area id `bubbleWash` exists), requires the map to be unlocked. `RunResult.seed` comes from `world.rngSeed`; `RunScreen` takes a `seed` prop, `Screen` run carries it. Same seed = same waves/objectives/loot rolls, not identical play. Only built-in `AREAS` get a copy button (custom maps/missions are device-local).
