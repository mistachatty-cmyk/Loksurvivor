# Lok Calibrate

Owner's idea (2026-11-27, Eric Hartfield II): the Lok ecosystem should know what device a player is on (console, TV, phone, tablet, laptop, desktop; which browser and operating system; what the hardware can do), pop a small card on screen, and when the player taps it, calibrate the game as well as the ecosystem can to that software and hardware for the best performance. Built as its own package so it can be split into another repo and later licensed or sold.

## What exists (0.42.98)
Package `artifacts/survivor-616/src/lib/lokCalibrate/`:
- `core.ts` (pure, test-enforced: its only import is the sibling console package). Facts in, profile out:
  - `classifyDevice`, `detectBrowser`, `detectOs`: console, TV, phone, tablet, laptop, desktop; Edge, Chrome, Firefox, Safari, Samsung Internet; Windows, Mac, iOS, Android, Linux, Xbox, PlayStation, Switch, TV.
  - `tierOf` and `buildProfile`: a low, mid or high tier from cores, memory and device class (Series X and PS5 high, Xbox One and PS4 mid, Switch and TVs low; Data Saver and low battery step it down).
  - Settings out: canvas pixel-ratio cap, 30 or 60 fps target, effect level, particle scale, shadows on or off, likely input mode, TV-safe margin.
  - `refineTier`: a live frame test can only lower the tier, never raise it.
  - `notes`: reasons shown to the player (console margins, 30 fps TV, older PlayStation browser, iPhone has no vibration, data saver, and so on).
- `runtime.ts`: reads facts from the browser, runs a 1.2 second frame test, stores only the choice (`lok.calibrate.mode.v1`: ask, on, off), publishes the active settings (`calibratedSettings()`), and sets `data-lok-quality` and `--lok-particles` on the page. Nothing leaves the device.
- `src/ui/CalibratePrompt.tsx`: the card. "We found: Xbox Series X|S in Edge. Turn on / Not now / Don't ask again." After turning on it shows what changed, with a Turn off button. It stays quiet on run and arena screens. When the choice is "on" it recalibrates silently at each launch.
- Already honored: `baseDpr()` in `lib/renderScale.ts` takes the calibrated pixel-ratio cap.

## How a game uses it
Read `calibratedSettings()` (or the `data-lok-quality` attribute and `--lok-particles` variable in CSS): scale particle counts, skip shadows on low, cap its frame rate. If it returns null, calibration is off; do nothing different.

## Not built yet
- Particle, shadow and frame-rate caps are published but only the canvas sharpness cap is applied by games today. Next: apply `particleScale` and `shadows` in the Survivor 616 renderer and the Lok Party juice engine.
- A Settings row to turn it on or off later and to re-run the test.
- A device database that learns from opt-in anonymous results (which devices needed the tier lowered) and ships a small lookup table with each release. Needs a backend table; no data is collected now.
- Per-game override files and a vendored `@lok/calibrate` package built with the same sync flow as `lok-universe`.
- Real-device verification: Series X, PS5, iPhone, Android, older laptops.

## Package boundaries
`lib/lokInput` (controls), `lib/couch` (lobbies), `lib/lokConsole` (console profiles) and `lib/lokCalibrate` (device tuning) each import nothing from any game. `lokCalibrate/runtime.ts` also uses the small generic `lib/devicePref.ts` helper, which would be vendored with it.

## Patent and sale note
This is not legal advice. If a patent is a goal, a registered patent attorney should be consulted before any public release or sale, because public disclosure (including this repo if it becomes public, and shipped builds) starts clocks in many countries. Software methods are hard to patent; trade secrets, copyright and trademark are usually the realistic protection. Keep dated records of the concept and the build history (this doc, git history) and keep the repo private until advised. Ownership of AI-assisted code is also an open legal area, so ask the attorney about it.
