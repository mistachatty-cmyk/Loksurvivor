# Soundtrack and mobile stability: fix plan (2026-10-20)

Status: **plan only. Nothing here is implemented.** Evidence is in
`docs/soundtrack-crash-audit-2026-10-20.md` (finding ids F1 to F8) and
`docs/soundtrack-speed-history-2026-10-20.md` (S1 to S4).

Rules that apply to every item (from `CLAUDE.md` and `docs/LOK_COST_DISCIPLINE.md`):

- Additive and low-risk first. No new network calls, no new assets, no runtime AI.
- Never use the banned word (see `CLAUDE.md`); use `beacon`, `pulse`, `relay`, `static`.
- Player text goes in `src/locales/en.json` only.
- Each release bumps `CHANGELOG` in `src/game/data/changelog.ts` and runs
  `pnpm exec tsx scripts/export-public-updates.ts public/lok-updates.json`.
- Run `pnpm typecheck` and `pnpm test` from `artifacts/survivor-616/` after each change.
- Do **not** rip out the analyser or the beat-reactive gameplay. The aim is to make
  them cheap, optional and safe, not to remove a feature the game is built around.

> **Second pass (same day):** `docs/soundtrack-song-audit-2026-10-20.md` audits the song
> files and adds items to this plan: volume through a gain node, level-matching tracks 03 and
> 07, retuning the Monroe Strip music-event thresholds, an intro retry that only starts the
> song, reconnecting the analyser on every resume, and two small content fixes. Fold them
> into Patch A (the intro and resume fixes) and Patch B (the rest).

## Order of work, and why

I cannot reproduce the crash here (no device), so the order is: **measure first,
then fix the cheap certain things, then harden the audio graph.** Phase 0 makes the
next crash produce data. Phase 1 removes avoidable load and fixes the speed bug.
Phase 2 is the iPhone audio hardening. Phase 3 locks it in with tests.

| Phase | Releases as | Size | Risk |
| :--- | :--- | :--- | :--- |
| 0. Instrument | its own patch | Small | Very low |
| 1. Cheap certain fixes | its own patch | Medium | Low |
| 2. Audio graph hardening | its own patch | Medium | Medium (iOS-only behavior) |
| 3. Tests and a smoke check | alongside each phase | Small to medium | Very low |

## Phase 0. Instrument the next crash (local only, no network)

**P0-1. Breadcrumb recorder.** A tiny module that keeps the last ~60 events in a
ring buffer in `localStorage`, written at most every 5 seconds and on `pagehide`
and `visibilitychange` to hidden. Each entry: timestamp, current screen name, track
id and position, `isPlaying`, `AudioContext.state` and `sampleRate`, playback rate,
`document.visibilityState`, and `performance.memory.usedJSHeapSize` where the
browser offers it. No personal data and nothing leaves the device.

**P0-2. "Last session ended unexpectedly" marker.** At boot set a `running` flag in
`localStorage`. Clear it on a clean `pagehide`. If the next launch finds it still
set, the previous session was killed (a tab kill or reload), not a caught error.
That one flag answers audit question F2 directly.

**P0-3. A readable fallback and a log viewer.** In `error-boundary.tsx`, show a
short error id and message in production too (not just `DEV`), use the game's dark
theme instead of the light grey panel, and write the error into the breadcrumbs.
Add a "Copy diagnostics" button in Settings that copies the last breadcrumbs as
text so a player can paste them to you.

Acceptance: force an error in a dev build and a manual page kill; both leave a
readable trail on the next launch.

## Phase 1. Cheap, certain fixes

**P1-1. Fix the speed mismatch (S2).** In `musicPlayer.tsx`:

- Set `audio.defaultPlaybackRate = rate` together with `audio.playbackRate = rate`
  in `setPlaybackRate` and in the effect at `:768-774`, so a new `src` keeps the
  chosen speed.
- After `audio.src = track.url` in `playIndex` (`:696`) and the conversion swap
  (`:1268`), re-apply the rate explicitly.
- Decide the product behavior (needs your call, below): either keep the speed
  across tracks, or reset it to 1x on every track change and update the UI.
- Keep the speed controls in the Music panel; consider removing the Soundbar's
  global speed button, or labeling speed "Experimental" because it time-stretches
  audio (S3).

Acceptance: a unit test with a fake audio element proves the rate survives a `src`
change and that touching volume never changes the rate.

**P1-2. Stop re-rendering every screen on each `timeupdate` (F4).** Split the
player context into two:

- a stable **transport** context (actions, current track, `isPlaying`, volume,
  rate, lists) that changes rarely, and
- a **progress** source (`progressSec`, `durationSec`) read with
  `useSyncExternalStore` or a small subscribe hook, used only by the seek bars in
  `MusicPanel` and `SoundbarPanel`.

Keep `useMusicPlayer()` returning the transport value so the 12 existing callers
keep compiling. `RunScreen` and `HubScreen` then stop re-rendering about four
times a second.

Acceptance: a render-count check on `RunScreen` while a track plays shows it no
longer re-renders on `timeupdate`.

**P1-3. Make the music overlay cheap, and honor the setting (F3, F5).**

- Drive the glow by writing `opacity` directly on one dedicated overlay element
  (a real node, not an inherited custom property), at most ~15 times a second,
  instead of setting `--music-energy` on the root every frame. This removes the
  whole-tree style recalculation.
- Drop `mix-blend-mode: screen` on touch devices, or remove it entirely.
- Make `MusicProvider` read `meta.musicReactiveEnabled`: when off, do not run the
  analyser loop or write the overlay at all, so the toggle actually saves work.
  Also stop the loop under reduced motion and when the tab is hidden.

Acceptance: with the setting off, no `requestAnimationFrame` loop runs from the
music player; with it on, the root element's style is not invalidated per frame.

**P1-4. Contain errors where they happen (F1).** Add a boundary inside `Game`
around the current screen, with `resetKey` set to the screen name, and a fallback
that offers **Back to hub** instead of remounting everything to intro. Keep the
outer boundary as the last resort. Optionally add a second boundary around the
music UI (`MusicPanel`, `SoundbarPanel`) so a widget error can never take a run
with it.

Acceptance: a throw inside a screen shows the fallback, "Back to hub" works, and
audio keeps playing underneath.

## Phase 2. Audio graph hardening (iPhone-focused)

These follow the team's own note in `.agents/memory/music-reactivity.md` and need a
real iPhone to verify, which is why they come after Phase 0 gives data.

**P2-1. Build the graph inside the gesture.** Call `ensureAudioContext()` and
`connectAnalyser()` synchronously in the tap handler, **before** `audio.play()`,
instead of in the promise after it (`musicPlayer.tsx:698-708`). This avoids
capturing the element into a context that is still suspended.

**P2-2. Handle every interruption.** Listen to the context's `statechange` event
and resume on `'suspended'` **and** Safari's `'interrupted'`, not only on
`visibilitychange` (`:881-890`) and not only for `'suspended'` (`:622`).

**P2-3. Rebuild on a route change.** On `devicechange`, a `statechange` back to
running, or a changed `sampleRate`, tear down and rebuild the media-element source
and analyser (S4). Log each rebuild to the breadcrumbs.

**P2-4. Bypass experiment.** Add a hidden setting or query flag to play the song
**without** the analyser (no Web Audio routing) so you can compare the same song
on the same phone. If sound is clean and crashes stop, the routing is the cause and
the setting can become a "Battery saver" option that turns reactivity off.

## Phase 3. Tests and a smoke check

- **Player lifecycle tests** (`node:test`, fake audio element): rate survives a
  track change; volume or mute never changes the rate; auto-advance and repeat
  modes; locked tracks refuse to play; `removeTrack` keeps the index consistent.
- **Content validation test:** every `MusicSpawnEvent` faction id, enemy id and
  palette id exists, so a typo fails CI instead of throwing mid-run (F8). Consider
  making `spawnMusicSquad` skip an unknown faction rather than throw.
- **Browser smoke test** using the existing Playwright setup: play a short
  generated WAV (not the bundled `.m4a`, which headless Chromium may not decode),
  cycle tracks, change volume and speed, and assert no page error and no remount
  to intro. Needs a Chromium executable (`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`,
  see `.agents/memory/browser-regression-tests.md`).

## Decisions I need from you

1. **Speed behavior.** After a track change, should speed (a) carry over, or
   (b) reset to 1x? I recommend (b) with speed kept only in the Music panel.
2. **Soundbar speed button.** Keep, relabel "Experimental", or remove it?
3. **Battery saver.** Are you happy for "Music reactivity: Off" to fully stop the
   analyser and overlay (not just gameplay reactions)? I recommend yes.

## What the owner can do right now (no code)

- Turn **Music reactivity** off in Settings and see whether crashes change. This
  only removes the gameplay read today, so a clean result is useful and a still-bad
  result confirms the heavier work (F3, F5) needs Phase 1.
- Note whether a grey "Something went wrong" panel appears at the crash (F2).
- Try the 30-second speed check in `docs/soundtrack-speed-history-2026-10-20.md`.

## Suggested release order

1. Patch A: Phase 0 (instrument) plus the speed fix P1-1. Small, safe, and answers
   the biggest open question.
2. Patch B: P1-2, P1-3, P1-4 and their tests.
3. Patch C: Phase 2, verified on a real iPhone using what Patch A recorded.
