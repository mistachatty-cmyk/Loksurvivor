# Lok console and TV support

Package: `artifacts/survivor-616/src/lib/lokConsole/` (pure, imports nothing from any game, test-enforced; ships later as `@lok/console` next to `@lok/input` and `@lok/couch`).

## What it does
- `detectConsole()` recognizes Xbox Series X|S, Xbox One, PlayStation 5, PlayStation 4, Switch and smart TVs from the user agent. Unknown devices are `none` and nothing changes for them.
- `consoleProfile()` gives each device a canvas pixel-ratio cap (Series X and PS5 start at 1.25, older consoles and TVs at 1), a target frame rate, a title-safe inset and the names of its buttons.
- `padHint('{primary} jumps, {menu} pauses')` writes the hint with the device's own names: A on Xbox, Cross on PlayStation.
- `rumble(strength, ms)` drives controller rumble through the Gamepad vibration actuator. Console browsers ignore `navigator.vibrate`, so this is the console path. Duration is capped at 400 ms.
- `applyConsoleProfile()` runs once at startup and sets `data-lok-console` and `--lok-tv-inset` on the page so any layout can opt in to the safe margin.

## How games use it
- Canvas size: `baseDpr()` and `FrameGovernor` in `lib/renderScale.ts` already read the profile. The governor can still step below the cap.
- Hints: write the locale string with `{primary}`, `{secondary}`, `{menu}` and pass it through `padHint`.
- Feedback: call `rumble()` next to `navigator.vibrate()`.
- Input itself still comes from `lib/lokInput` (standard gamepad mapping: button 0/1/2/3 are A/B/X/Y on Xbox and Cross/Circle/Square/Triangle on PlayStation).

## Not verified on hardware
Nothing here has run on a real Xbox or PlayStation. Edge on Xbox reports about 1280x720 CSS px and its overlay can steal focus; PlayStation's browser is old WebKit, so WebGL or newer syntax may not work, and the game is Canvas2D only. WebGPU is not used. Needs an on-device pass before calling this finished.

## Next
Use `--lok-tv-inset` in full-screen menus, show glyph icons (not just names) in the input pad, and test the PlayStation browser's gamepad mapping.
