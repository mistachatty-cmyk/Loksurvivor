# Song-by-song audit, and what edits songs live (2026-10-20)

Status: **audit only. No game code or audio file was changed.** Second pass, after
`docs/soundtrack-crash-audit-2026-10-20.md` (F1 to F8), `docs/soundtrack-speed-history-2026-10-20.md`
(S1 to S4) and `docs/soundtrack-fix-plan-2026-10-20.md`. Where this document disagrees
with those, this one is newer.

Checked against `main` at `751789f` (v0.41.1), which was still the tip of `origin/main`
when this was written. Open PRs #297, #300 and #301 (Demo Day) do not touch audio.

## Why this exists

The crash on mobile is described as consistent, so this pass looked at what the first
pass could not: the **audio files themselves**, every **song-change path**, and what the
game does **to** the songs or **because of** the songs while they play.

## Short answer

1. **The song files are not corrupt.** All 12 decode end to end with no error, headers
   match real length, and the index sits at the front of each file (good for phones).
2. **Nothing in the code is keyed to how far through a song you are.** No 30%, 60% or
   70% logic exists. The pattern you see is not coming from a song-position rule.
3. **The game does not edit songs while they play.** The only code that writes to the
   audio element is the player itself, and only your own controls (and a few screens
   that start a song) drive it. See "Everything that can change a song".
4. **Songs do edit the game.** Two Monroe Strip spawn events read the song's loudness.
   Measured against the real album they are broken: one behaves like a timer, the other
   can never fire (L2).
5. **The album is mastered very hot, and two tracks are far quieter** (A2, A3). On an
   iPhone the volume sliders probably do nothing (L3). Both make the sound feel "wrong"
   without any crash.
6. **Two more real bugs turned up in a browser run:** the title screen's first tap can
   pause the title song (L6), and after any pause and resume the beat-reactive features stay
   off until the track changes (L7).
7. **I still cannot name the crash.** All 12 songs played through 10%, 30%, 60%, 70% and
   90% with no error, crash panel or memory growth in a real Chromium run on a phone-sized
   screen. That clears the songs and the player code on desktop; it cannot clear a phone
   killing the tab. See "Playback test" and "Where that leaves the crash".

Confidence labels as before: **Confirmed**, **Likely**, **Hypothesis**.

## How this was checked

- `ffprobe` and a full `ffmpeg -xerror` decode of all 12 bundled files.
- MP4 atom order, per-song loudness, peak and full-scale counts, and loudness around
  30%, 60% and 70% of each song.
- A re-implementation of the game's analyser (1024-point FFT, Blackman window,
  smoothing 0.8, byte range -100 to -30 dB, then the band and energy smoothing from
  `analysis.ts`) run over each song to see where the Monroe Strip thresholds fire.
  This is **my model of the browser's analyser, not the browser's own output**.
- Reading every caller of the player (`useMusicPlayer` consumers) and every code path
  that starts, skips, seeks or re-rates a song.
- `git log` for every commit that touched the player, analyser, beat bus, reactivity or
  music-event files.
- A real Chromium run on a phone-sized viewport (see "Playback test").

## The 12 songs

All files: AAC-LC, mono, 44.1 kHz, about 24 kbps, `.m4a`, under `public/music/lokifed-take-1/`.

| # | Song | Length | Size | Mean level | Reaches full scale |
| :-- | :-- | --: | --: | --: | :-- |
| 00 | Data Spark (hidden) | 2:50 | 530 KB | 0.36 | yes |
| 01 | Save My Grace | 1:53 | 351 KB | 0.27 | yes |
| 02 | Bonus Map | 2:14 | 418 KB | 0.30 | yes |
| 03 | Merci Mi | 3:42 | 694 KB | **0.08** | no (peak 0.78) |
| 04 | I Want You | 2:40 | 502 KB | 0.35 | yes |
| 05 | Retrieve to Keep | 2:35 | 488 KB | 0.30 | yes |
| 06 | IDK, Do You? | 1:48 | 338 KB | 0.30 | yes |
| 07 | Blank's March | 2:06 | 390 KB | **0.09** | barely |
| 08 | Hideout Under Siege | 2:58 | 557 KB | 0.30 | yes |
| 09 | Unraveled | 2:34 | 480 KB | 0.32 | yes |
| 10 | Null Void | 2:41 | 504 KB | 0.31 | yes |
| 11 | Exo Bite | 1:49 | 338 KB | 0.18 | barely |

"Mean level" is average loudness on a 0 to 1 scale (RMS of the decoded file).

## Findings

| ID | Finding | Confidence |
| :-- | :-- | :-- |
| A1 | All 12 files are valid and play through | Confirmed |
| A2 | 9 of 12 songs are mastered to full scale | Confirmed (levels); Likely (audible distortion on phones) |
| A3 | Tracks 03 and 07 are about 11 dB quieter than the rest | Confirmed |
| A4 | Source quality is low: mono, about 24 kbps | Confirmed |
| L1 | Nothing in the game edits a song while it plays | Confirmed |
| L2 | Monroe Strip music events do not work as designed against this album | Likely (modelled, not measured in a browser) |
| L3 | No gain node, so iPhone volume sliders likely do nothing | Likely |
| L4 | Entering the Studio can try to play a locked song | Confirmed |
| L5 | A hideout call targets a song id that no longer exists | Confirmed |
| L6 | Where autoplay is allowed, the first tap on the title screen pauses the title song | Confirmed (real browser run) |
| L7 | Pausing and resuming a song permanently switches off beat-reactive features until the track changes | Confirmed (code and real browser run) |

### A1. The files are fine

Every file decodes with no warning, the header length matches the decoded length, and
the `moov` index comes before the audio data, so a phone can start and seek without
downloading the whole file. No service worker or PWA cache exists in the app, so there
is no cache layer to mishandle range requests. The host sends `Cache-Control` and CORS
headers for `/music/*` and nothing that would stop playback.

### A2. Hot masters

Nine songs each have over a thousand samples pinned at digital full scale (two more
touch it briefly, and only Merci Mi stays clear). At 24 kbps
AAC, a master that loud tends to overshoot when decoded, which sounds like harsh
distortion on small speakers. The game then adds its own effects on the same output with
no limiter. That is a sound-quality problem, not a crash.

### A3. Uneven loudness between tracks

Merci Mi (03) and Blank's March (07) average about 0.08 to 0.09 while most of the album
sits near 0.30, about **11 dB** quieter. Auto-advance, shuffle and the Soundbar jump
straight between them with no level matching, so the volume lurches. People often report
this as "the song sped up or changed".

### A4. Mono, 24 kbps

The files are small (about 5.7 MB for the whole album) but they are low quality by
design or by accident. If better sound is wanted, the fix is new encodes, not code.

### L1. What can change a song

Only `musicPlayer.tsx` writes to the audio element. The complete list of things that can
start or change a song:

| Source | What it does | Notes |
| :-- | :-- | :-- |
| Your controls (Music panel, Soundbar, now-playing bar, Settings volume) | Play, skip, seek, volume, speed | Manual. Speed bug is S2 in the speed doc |
| First tap or key (`a697bdd`, 2026-10-04) | Starts the title song once, then removes itself | Safe |
| Intro screen | Toggles play | Safe |
| Studio screen on entry | Picks a **random** song and plays it | See L4 |
| Hideout rooftop room | Calls `playTrackOnRepeat('rbm')` | See L5 |
| Song ends | Moves to the next song or repeats | Normal |
| Unlocking a song after an objective | Updates a lock flag only | Does not touch the playing song |

Gameplay (the run loop, enemies, areas, abilities) never calls the player. Beat-reactive
features only **read** the beat bus.

### L2. The songs drive spawns, and the thresholds do not fit this album

Only Monroe Strip has music events (`data/areas.ts:70-81`):

- **Bass swell:** when the bass level reaches 0.75, spawn 4 Nightcrawlers, at most once
  per 20 seconds.
- **Choir arrival:** when overall energy reaches 0.85, spawn the Afterimage Choir, at
  most once per 45 seconds.

Modelled on all 12 real songs:

- The bass level is **at or above 0.75 for 86% to 98% of every song.** So the bass swell
  is not responding to bass hits. It fires on its 20 second cooldown, all the time, like
  a timer. In a 120 second run that is about six bursts of four, roughly 24 extra enemies.
- Overall energy peaks at **0.33 to 0.45** on every song. It never reaches 0.85, so the
  choir arrival **can never fire**. It is dead content.
- The firing times repeat about every 12% to 20% of a song because of the cooldown, not
  because of the music. They do not cluster at 30%, 60% or 70%.

Caveat: this is my model of the browser's analyser. Chrome and Safari may differ by
several points. It should be confirmed by logging the real band values on a device. The
conclusion (a bass threshold that is always met, an energy threshold that is never met)
is robust to errors of that size.

Related, not measured: the `bassBulge` and `conePulse` visual presets read the sub-bass
band. With masters this hot they may sit swollen instead of pulsing. (Hypothesis.)

### L3. Volume on iPhone

The audio graph is element, analyser, destination. There is no gain node, so the app's
volume control sets `audio.volume`. Apple documents that iOS ignores `volume` on media
elements (the user's hardware buttons own the level). If you are on an iPhone, the
Music panel, Soundbar and Settings volume sliders most likely change nothing. Combined
with A2 and A3, that matches "the sound is messed up". (Likely. Not applicable on
Android. Your device is still unknown.) The fix is a gain node for volume.

### L4. The Studio can pick a locked song

`StudioScreen.tsx:94-106` picks a random song from `music.tracks` on entry. That list
includes **locked** songs. `playIndex` refuses a locked song and shows "Finish N
objectives to unlock...". So entering the Studio sometimes shows an error and leaves the
previous song (or silence) in place instead of switching. The now-playing bar filters
locked songs; the Studio does not.

### L5. A dead room song

`HubScreen.tsx:408` calls `playTrackOnRepeat('rbm')` when you enter the rooftop room. No
track has the id `rbm` anywhere in the code (the album ids all start `lokifed-`), so the
call silently does nothing. The rooftop was meant to play its own song. It has not since
the album was reorganised (`cd38293`, 2026-10-05). Harmless, but the feature is gone.

### L6. The first tap can pause the title song

`IntroScreen.tsx:84-104` calls `player.togglePlay()` once on mount and again on the first
`pointerdown`. It assumes the mount attempt always fails because the browser blocks
autoplay. When autoplay **is** allowed, the title song starts on its own and the first
tap then toggles it **off**. In the real browser run this showed as a `pause` event
about 1.5 seconds after `playing`, with no error and no end of song. This depends on the
browser's autoplay rules (a site you have used a lot can earn autoplay in Chrome), so it
may happen for you on some launches and not others. A "toggle" is the wrong verb for a
retry; it should only ever start.

### L7. Resume never restarts the analyser

`togglePlay()` (`musicPlayer.tsx:1371-1403`) resumes with a bare `audio.play()`. Only
`playIndex()` calls `connectAnalyser()` and `startEnergyMeter()`. Pausing runs
`stopEnergyMeter()` (`:728-731`), so after **any** pause and resume (Music panel, the
now-playing bar, the Soundbar, the pause menu) the analyser loop stays off until the track
changes. Beat-reactive actors, the glow overlay and Monroe Strip's music events go quiet
for the rest of that song. The same happens for a title song started through the intro's
`togglePlay()` path: in the browser run the energy reading stayed at 0 while the song
played. This is a quiet loss of a feature, not a crash, but it makes reactions feel
random ("it works after I skip a track").

## What this changes in the fix plan

Add to `docs/soundtrack-fix-plan-2026-10-20.md`:

1. **Volume through a gain node** (L3). Small, and probably the biggest audible win on iPhone.
2. **Match song levels** (A3), for example a stored per-song gain applied through that
   same node. No re-encode needed.
3. **Re-tune the Monroe Strip thresholds** (L2) against real band values, or normalise
   band and energy readings per song so thresholds mean the same thing on every song.
   Add a test that every music event is reachable on at least one bundled song.
4. **Filter locked songs in the Studio's random pick** (L4).
5. **Point the rooftop at a real song, or remove the call** (L5).
5a. **Make the intro retry start-only, never toggle** (L6).
5b. **Reconnect the analyser on every resume** (L7): call `connectAnalyser()` and
    `startEnergyMeter()` from the `play` event handler instead of only from `playIndex`.
6. Optional later: re-encode the album at a higher bitrate and a lower peak level (A2, A4).

## Playback test (real Chromium, phone-sized viewport)

Method: the dev server, Chromium at 390 x 844 with touch, autoplay blocked the way a phone
blocks it, all 12 songs unlocked through a saved-progress flag. Open-source Chromium cannot
decode AAC, so the same 12 songs were served as WAV copies from a scratch folder (nothing
in the repo changed). For each song the test jumped to 10%, 30%, 60%, 70% and 90%, waited
4.5 seconds at each, then jumped near the end and let the player advance by itself. It
recorded page errors, unhandled promise rejections, the crash panel text, pauses, media
errors, JS heap and long main-thread tasks. The scripts are in `docs/audit-tools/`.

Result: **12 of 12 songs played through every checkpoint with nothing wrong.**

- No page error, no unhandled rejection, no crash panel, no media error, no unexpected pause.
- Auto-advance worked at the end of each song, in order, through all 12.
- JS heap stayed flat, between about 66 and 96 MB for the whole run. No growth, no leak.
- The analyser worked on tracks 01 to 11 (energy readings 0.08 to 0.43). That matches the
  model's range (peaks 0.33 to 0.45), which backs the L2 finding that the energy threshold of
  0.85 is unreachable.
- Track 00 (Data Spark, started by the title screen) showed energy 0 the whole time. That is
  L7, seen live.
- Long main-thread tasks (over 50 ms) appeared in bursts during tracks 02 and 03 and were
  rare in the others. They did not line up with any point in a song. The title screen runs a
  bot-played copy of the real game behind the logo (`AttractMode`), so they most likely follow
  its scene changes. Worth remembering: the title screen is the heaviest idle screen.
- The browser reported `ERR_TUNNEL_CONNECTION_FAILED` for a few outside requests. That is this
  sandbox blocking the network, not the app.

What this does and does not prove:

- **It rules out** a script error in the soundtrack code at or near 30%, 60% or 70% of any
  bundled song, a bad song file, a bad seek, and a memory leak across songs, **on desktop
  Chromium**.
- **It does not reproduce your crash.** A phone has far less memory and a different audio
  stack, and the test did not run an actual gameplay session. A tab killed by the phone for
  using too much memory or graphics power never raises a page error, so a clean run here is
  exactly what that kind of crash would also look like.
- It cannot test Safari or the iPhone audio route (S4 in the speed doc).

## Where that leaves the crash

Everything checkable without your phone now points the same way: **the songs and the
soundtrack code are not throwing errors.** The remaining suspects are the load findings from
the first audit (F3 whole-app style updates about 60 times a second, F4 constant re-renders)
plus the title screen's bot game, and the iPhone audio-route behaviour. Only your phone can
settle which. That is what Patch A in the fix plan is for: a local crash trail that records
the screen, the song and position, the audio state and memory just before the app dies.

If you can answer one thing, answer this: **does it happen on the title screen, in the
hideout, or inside a run?** The title screen alone (bot game plus song) is a real suspect.

## Reproduce

- `docs/audit-tools/song-analyser-sim.py`: models the analyser over the bundled songs (needs `ffmpeg`, `numpy`).
- `docs/audit-tools/song-playtest.mjs`: the browser run above (needs the dev server, Playwright and Chromium).
