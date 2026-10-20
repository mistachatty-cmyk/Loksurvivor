# Soundtrack crash and speed audit (2026-10-20)

Read before changing `src/game/audio/musicPlayer.tsx`, the `.music-reactive-root`
CSS, or the error boundary. Full detail is in `docs/soundtrack-crash-audit-2026-10-20.md`,
`docs/soundtrack-speed-history-2026-10-20.md` and `docs/soundtrack-fix-plan-2026-10-20.md`.

## Durable facts

- The only ways to reach the `intro` screen are the first mount and one Back button
  (`App.tsx:220`, `:576`). A crash that lands on intro is a full remount (outer
  `ErrorBoundary`, "Try again") or a page reload (OS tab kill), never a normal
  navigation. In production the boundary fallback hides the error text.
- Nothing outside `musicPlayer.tsx` writes `src`, `currentTime`, `volume`, `muted` or
  `playbackRate` on the audio element. Beat-reactive gameplay is read-only for audio.
  Keep it that way (see `music-reactivity.md`).
- Setting `audio.src` resets `playbackRate` to `defaultPlaybackRate` (the HTML load
  algorithm). The player stores the chosen rate in state but does not re-apply it
  after a track change, so the speed UI and the element can disagree, and touching
  volume or mute re-applies the stale rate and jumps the speed.
- Playback speed was added on 2026-10-04 (`e177eb8`, the AI Studio merge). Before
  that the player had no speed control.
- `--music-energy` is written on the app-wide root every frame and inherited by the
  whole DOM, and `.music-reactive-root::before` is a full-screen blend overlay. The
  "Music reactivity" setting only gates the run loop's read of the beat bus, not this.
- The context value includes `progressSec`/`durationSec`, so every `useMusicPlayer()`
  caller re-renders on each `timeupdate`.
- The recovery listener resumes only `'suspended'`; Safari also uses `'interrupted'`.

## Second pass: the songs themselves (docs/soundtrack-song-audit-2026-10-20.md)

- All 12 bundled `.m4a` files are valid (full decode clean, index first, mono AAC about
  24 kbps). Nothing is keyed to how far through a song you are. The game never edits a song;
  songs only drive gameplay through `reactivity.ts` and Monroe Strip's `musicEvents`.
- A real Chromium run (phone viewport, autoplay blocked, WAV copies) played all 12 songs
  through 10/30/60/70/90% with no error, crash panel or heap growth. The crash is still
  unreproduced; suspect phone memory or graphics pressure (and the title screen's bot game),
  which a page error would never show. Use the Patch A crash trail to settle it.
- 9 of 12 songs are mastered to full scale; tracks 03 and 07 are about 11 dB quieter. Monroe
  Strip's bass trigger (0.75) is met 86 to 98 percent of the time and its energy trigger
  (0.85) never fires (real energy tops out near 0.45). Retune against real band values.
- No gain node: volume is `audio.volume`, which iOS ignores. Route volume through a gain node.
- Bugs to fix: `IntroScreen` retry toggles instead of starting (pauses the title song when
  autoplay is allowed); `togglePlay` resume never restarts the analyser; Studio's random pick
  can choose a locked song; `HubScreen` calls `playTrackOnRepeat('rbm')`, an id that no longer
  exists.
- Tools to re-run: `docs/audit-tools/`. A saved-progress injection for tests needs `version: 1`.

## Status

Audit only, no code changed. Typecheck clean, 1020 tests green. The crash was **not**
reproduced (no device or browser in the audit sandbox), so the causes of the mobile
crash itself are ranked, not proven. Do the instrumentation phase before guessing.

## Cheap wins once approved

Pin the rate to the element on every load, split progress out of the main context,
drive the overlay with direct opacity at a low rate, honor the reactivity setting,
add a per-screen error boundary, and validate music-event ids in a test.
