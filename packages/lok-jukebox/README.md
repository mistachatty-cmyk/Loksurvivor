# @lok/jukebox

Pure logic for the Lok Jukebox. No audio, DOM or React code, so every Lok app can share it and test it under plain `node --test`.

- `theater.js`: the three theater levels (`levelAt`, `nextChangeIn`). Level 1 for 4 s after a touch (UI full, dampen 3.5), Level 2 for the next 20 s (UI translucent, dampen 1.5), then Level 3 (UI hidden, dampen 0) until the next touch.
- `tone.js`: `dampenToTone(dampen)` gives a low-pass cutoff and a bass shelf for the app to apply with `setTargetAtTime`.
- `bands.js`: slow smoothing and bounded grade values for the room's reactive color.
- `manifest.js`: `validateManifest(tracks)` checks an app's disc list (ids, patterns, palettes, https links).

The app owns the audio graph. In 616 Survivor the filters sit AFTER the analyser, so beat detection and the grade always see the true, undampened sound.

Run the tests: `pnpm --filter @lok/jukebox test`.
