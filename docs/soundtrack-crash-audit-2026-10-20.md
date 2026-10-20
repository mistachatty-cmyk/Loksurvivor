# Soundtrack and mobile crash audit (2026-10-20)

Status: **audit only. No game code was changed.** Written against `main` at
`751789f` (v0.41.1). Companion docs:

- `docs/soundtrack-speed-history-2026-10-20.md`: why songs seem to speed up and
  slow down, with the commit timeline.
- `docs/soundtrack-fix-plan-2026-10-20.md`: ordered fixes, tests and the
  questions that would narrow things fastest.

## Why this exists

Reported on mobile: the app crashes while playing through, especially when a
song is roughly 30%, 60% or 70% through, and it drops back to the intro screen.
Separately, songs sound like they speed up and slow down in places they should
not, and the effect reaches the whole app, not just a run.

## How this was checked, and what could not be

Done:

- Read the whole soundtrack path: `src/game/audio/` (player, analyser, beat bus,
  SFX, ambience, studio engine wiring), every UI file that consumes the player,
  the music hooks in `engine/world.ts`, and the crash-containment code
  (`error-boundary.tsx`, `main.tsx`, `App.tsx`).
- Searched the full git history (706 commits, 2026-08-25 to 2026-10-19) for when
  each audio behavior arrived.
- `pnpm typecheck`: clean. `pnpm test`: **1020 of 1020 pass.**

Not done, and why it matters:

- **No device or browser was available.** The sandbox has no Chromium (the
  download is blocked), so nothing here was reproduced on a phone. Every finding
  below is marked with how sure it is.
- The bundled soundtrack is `.m4a`, which headless Chromium builds often cannot
  decode, so even with a browser this would have needed generated test audio.

Confidence labels used below: **Confirmed** (read directly in code or covered by
a test), **Likely** (follows from the code plus documented browser behavior, not
reproduced), **Hypothesis** (plausible, needs a device test).

## Short answer

1. **No syntax or type errors exist** in the soundtrack code. Typecheck is clean
   and the suite is green. Nothing found is a "typo" bug.
2. **"Crashes to intro" has a precise meaning in this codebase.** The only ways
   to land on the intro screen are the first mount and one Back button
   (`App.tsx:220`, `:576`). So a crash that ends on intro means the whole React
   tree was remounted or the page was reloaded. That narrows the cause a lot (see
   F1 and F2).
3. **Nothing in the code reads "how far through a song" as a fraction.** There is
   no logic keyed to 30, 60 or 70%. Those marks most likely coincide with louder
   passages or with accumulated play time. See "About 30, 60 and 70%".
4. **The game cannot change a song's speed.** Every write to the audio element
   lives in `musicPlayer.tsx`. The speed controls are manual and global, and
   they have a real state mismatch bug that can look exactly like songs changing
   speed on their own (companion doc).
5. The music-reactive features **are** app-wide by design, but visually, not
   audibly: one CSS variable written about 60 times a second on the root of the
   whole app (F3). That is the likeliest source of mobile strain.

## What is verified clean

- Typecheck passes; 1020 tests pass. No test fails or is skipped.
- Outside `musicPlayer.tsx`, nothing writes `src`, `currentTime`, `volume`,
  `muted` or `playbackRate` on the audio element. The beat-reactive gameplay
  code (`reactivity.ts`, `musicMultiplier`, `applyMusicEvents`) only reads the
  beat bus and changes actors, spawns and palettes.
- The analyser only reads (`getByteFrequencyData`). It cannot alter sound.
- The effects engine is bounded: 12 concurrent voices (`sfxCues.ts:172`, `:184`),
  per-cue cooldowns, nodes disconnected on end, calls wrapped in try/catch.
- Earlier audio crashes were already fixed (commit `edeb155`, 2026-09-05):
  double-revoked object URLs, an unbounded shuffle loop, a throwing
  `AudioContext.close()` in cleanup. Those fixes are present and correct.

## Findings

| ID | Finding | Confidence | Relevance to your symptoms |
| :--- | :--- | :--- | :--- |
| F1 | One error boundary sits above everything, including screen state | Confirmed | Explains why any error looks like "reset to intro" |
| F2 | Production fallback shows no error text; most "crashes" may not be JS errors at all | Confirmed | Explains why this has been hard to diagnose |
| F3 | The music drives a whole-app style change about 60 times a second | Confirmed (cost unmeasured) | Likeliest mobile strain, including whole-app effects |
| F4 | Every screen re-renders about 4 times a second while a song plays | Confirmed | Adds load during runs and in the hideout |
| F5 | The "Music reactivity" setting does not switch off any of that work | Confirmed | Players cannot turn the strain off |
| F6 | The audio graph is built late and only recovers from one interruption type | Likely | Silence, glitches, wrong pitch on iPhone |
| F7 | No test touches the player lifecycle | Confirmed | Green CI says nothing about these bugs |
| F8 | Music events can throw on a bad id; nothing validates them | Confirmed | Latent only. Current data is valid |

### F1. A single boundary above all state means any error resets the app

`App.tsx:877-884` wraps `Providers` and `ThemedGame` in `ErrorBoundary`, and
`main.tsx:86-90` wraps that again. The screen lives in `Game` as
`useState<Screen>(() => initialScreen())` (`App.tsx:220`), and `initialScreen()`
returns `{ name: 'intro' }` (`App.tsx:214`). So when any component throws during
render, the boundary replaces the whole tree. Pressing "Try again" remounts
everything below it, `Game` runs `initialScreen()` again, and the player is on
the intro screen with the run gone.

There is no boundary around a single screen, the run, or the music panel. One
bad render in a small widget costs the whole session.

### F2. The fallback hides the error, and a reload would look identical

`error-boundary.tsx:51-55` prints the error message only when `import.meta.env.DEV`
is true. In production the player sees a light grey "Something went wrong" panel
with no detail, and the stack goes only to `console.error`, which nobody reads on
a phone.

Important consequence: if the crash goes **straight to the title screen without
that grey panel**, it was not a caught JavaScript error. It was a page reload,
which on iOS Safari and Android Chrome is what happens when the OS kills a tab
for memory or GPU pressure. That points at F3 and F4, not at a logic bug. This is
the single most useful thing to learn from the next crash (see the fix plan).

### F3. A whole-app style change about 60 times a second

`musicPlayer.tsx:583-601` creates the analyser, whose `onEnergy` callback does
`reactiveRootRef.current?.style.setProperty('--music-energy', ...)` on every
animation frame (`:589`). That element is `.music-reactive-root`, the wrapper
around **every screen** (`musicPlayer.tsx:1611-1617`).

Why that is expensive: a CSS custom property is inherited, so changing it on the
root invalidates style for the entire DOM subtree beneath it, every frame. The
hideout and menus have large DOM trees.

Compounding it, `index.css:857-873` adds a full-screen fixed `::before` with a
`12rem` inset box-shadow whose opacity is `calc(var(--music-energy) * .09)`, and
during runs `mix-blend-mode: screen` (`:871-873`). A blend mode on a full-viewport
layer over the game canvas forces the compositor to isolate and blend the page
beneath it. At a peak opacity of 0.09 the visible benefit is tiny; the cost is
paid on every frame on every screen, including menus where nothing else animates.

This design dates from the first music commit (`62ea810`, 2026-08-25) and is not
a recent regression. What changed later: the analyser grew from a 128-point
average to a 1024-point tempo and onset pipeline (`c0c3d53`, 2026-08-28), which
raised the per-frame cost.

Confidence note: the mechanism is certain. How much of the mobile instability it
accounts for has **not been measured**. A phone profile or the breadcrumb log in
the fix plan would settle it.

### F4. Every consumer re-renders on each `timeupdate`

`musicPlayer.tsx:725` sets `progressSec` from the audio element's `timeupdate`
event (browsers fire it at least every 250 ms while playing), and `progressSec`
and `durationSec` are part of the single context value (`:1503-1504`, deps at
`:1563-1564`). Any change to that object re-renders **every** component that calls
`useMusicPlayer()`, even if it reads one field.

Consumers include `RunScreen` (`:238`, 2,737 lines) and `HubScreen` (`:168`,
1,447 lines, which reads only two actions). `RunScreen` uses the player only in
the pause menu (`:2507-2551`), yet re-renders about four times a second all run
long. This is avoidable work that competes with the canvas loop on a phone.

### F5. The "Music reactivity" toggle does not turn off the work

`SettingsPanel.tsx:810-819` toggles `meta.musicReactiveEnabled`. The only reader
is `RunScreen.tsx:342-343` and `:1022`, which swaps the beat frame for a silent
one inside the run loop. The analyser still runs, `--music-energy` is still
written, and the overlay still renders on every screen. A player who turns the
setting off to save battery or stop a crash gets none of that benefit.

### F6. Late graph construction, and only one recovery path

- The Web Audio graph (`createMediaElementSource` into an analyser into the
  destination) is created **after** the first successful `play()`
  (`musicPlayer.tsx:698-708`, `connectAnalyser` at `:626-642`). The element starts
  playing natively and is rerouted afterward. On iOS, creating or resuming a
  context outside the synchronous part of a user gesture can leave it suspended,
  and a media element already captured by a suspended context is silent while its
  clock keeps running.
- The recovery listener (`:881-890`) resumes only when `state === 'suspended'`.
  Safari on iOS also reports a non-standard `'interrupted'` state after a phone
  call, alarm, Siri or route change. That state is not handled, so music can stay
  silent until a reload.
- Once routed through Web Audio, playback on iOS depends more on the main thread.
  When F3 and F4 keep it busy, glitching and stretched or warbled audio become
  more likely. (Hypothesis: needs an on-device comparison with the analyser
  bypassed.)
- The team already recorded the next likely cause of garbled pitch: WebKit's
  sample-rate problem after an audio route change, fixed only by rebuilding the
  source and analyser graph (`.agents/memory/music-reactivity.md`).

### F7. Coverage gap

The 1,020 tests cover the engine, data and studio models, but nothing exercises
`MusicProvider`: track changes, auto-advance, playback rate, volume re-application
or recovery. That is why every one of these issues passed CI.

### F8. Music events throw on a bad id

`applyMusicEvents` (`world.ts:2969-2999`) fires `spawnMusicSquad`, which calls
`getFaction`, and `getFaction` **throws** on an unknown id (`factions.ts:234-240`).
`getEnemy` is forgiving (`enemies.ts:2998-3006` falls back and warns). Only one
area defines music events today, Monroe Strip (`areas.ts:70-81`), and both ids it
uses exist (`afterimage-choir`, `nightcrawler`). So this is not the cause now. It
is a trap for future content, because no test checks music-event ids, and a throw
there happens at a random loud moment mid-run.

## About 30, 60 and 70%

I could not find any code that computes song progress as a fraction or acts on
one. The pattern is real in your testing, but the likely explanations are:

1. **Loud or dense passages.** Choruses and drops raise band energy, which is
   what music events and beat reactions key on (Monroe Strip spawns a squad at
   high energy, `areas.ts:70-81`), and heavier fights mean more effects and more
   per-frame cost (F3, F4).
2. **Accumulated time.** If tracks run three to four minutes, 30 to 70% is roughly
   one to three minutes of continuous play. A memory or GPU budget being crossed
   after a minute or two fits a page being killed (F2) better than a logic bug.
3. **Coincidence with a specific song or screen.** This needs your input, below.

## Smaller observations

- `noiseBuffer` in `sfxEngine.ts:34-40` allocates a fresh random buffer per noisy
  effect with no cache. Bounded by the 12-voice cap, so low priority.
- Screen state is not persisted (`App.tsx:220`), so any reload returns to intro.
  That is correct behavior for a reload, but it magnifies the cost of any crash.
- `musicPlayer.tsx:1475-1481` and the effect at `:768-774` are the speed bug,
  covered in the companion doc.

## What would narrow it fastest

Three facts from the next crash:

1. Do you see a grey or white "Something went wrong" panel, or does the app jump
   straight to the title screen?
2. Which device, OS and browser, and is it opened in the browser or added to the
   home screen?
3. Which screen is open (a run, the hideout, the music panel), and does it still
   happen with music paused or muted?

The fix plan adds a small local crash recorder so these answers are captured
automatically, with nothing sent over the network.
