# Lok Input and Game Mode: plan and design rules

Status: base built in `artifacts/survivor-616/src/lib/lokInput/` and `src/lib/gameMode.ts`. The rest below is planned, not built.

## Why
A browser can park keyboard focus on its own overlay (for example a fullscreen button added by a gaming mode), so arrow keys never reach a game. Players also should not have to dig into browser menus. Every Lok game should handle mouse, touch, keyboard and gamepad the same way, with one small control to see and switch the mode, and one switch for Game Mode (whole screen).

## Design rules for every Lok game
1. Do as much as possible in the app. Never rely on a browser menu to make controls work.
2. Games react to actions (`dir`, `primary`, `secondary`, `tertiary`, `quaternary`, `num`), never to key codes or button indices.
3. Fire on press (pointerdown, keydown, button edge), never on release or click.
4. Never leave the player stuck: Game Mode always shows an Exit button, Esc is left to the browser, and the pad can always be dragged or switched.
5. Input buttons use `tabIndex={-1}` so focus never walks onto them; keys are claimed on `keydown` in capture phase and stray focus is dropped.
6. Feedback on every switch: a small pop ring, a quiet two-note blip on the shared AudioContext (gain 0.035), reduced motion respected.
7. Original line art only. No emojis, stock icons or system symbols.
8. The input module must not import from the game. Text arrives as props, audio as a getter.

## What exists now
- `core.ts`: modes (`pointer`, `keyboard`, `gamepad`), `actionForKey`, `padActions` (D-pad, stick, A/B/X/Y), saved prefs (`lokinput.v1`: mode, position, locked), `subscribeActions`, `popBlip`. Using any device switches the pad to it, which catches whatever the player picked up.
- `LokInputPad.tsx`: the translucent button. Tap cycles mouse, keyboard, gamepad with a pop. Drag moves it anywhere (fractions of the viewport). A lock chip pins it in place. A short legend shows the controls for the current mode.
- `src/ui/LokInputDock.tsx`: game-side adapter that gives the pad translated text. `src/ui/GameModeButton.tsx` and `src/lib/gameMode.ts`: fullscreen with exit.
- Wired into: Lok Party hub, lobby, board, results and Ring Run Rush. The board and Ring Run Rush read actions from `subscribeActions`.

## Planned (not built)
1. Mount the dock in the main game and the hideout; map `RunScreen` movement to held-direction state (needs a held-state API next to the press actions).
2. Rebinding: per-game action to key/button map, saved in prefs.
3. Gamepad extras: rumble on hits where supported, trigger/shoulder actions, on-screen button legend with real glyphs.
4. Snap zones: when locked, a few anchor spots (corners, edges) instead of free placement.
5. Touch overlay mode: a transparent on-screen D-pad and buttons the player can place, for browsers with no keyboard or pad.
6. Per-game profiles and a settings page for dead zones and repeat rates.
7. Tests with a fake `navigator.getGamepads`.

## Extraction into its own repo (plugin)
- Package name idea: `@lok/input`. Contents: `core.ts`, `LokInputPad.tsx`, `index.ts`, `gameMode.ts`. Peer dependency: react only.
- The folder is already import-clean; a test (`ringRun.test.ts`) fails if a game import sneaks in.
- Host contract: call `subscribeActions(fn)` in the game, mount `<LokInputPad labels getAudioContext />` once, optionally `useGameMode()` for fullscreen.
- Vendor it like `lib/lok-universe`: edit in the new repo, sync a copy back, never edit the copy.
- Cost: no network, no storage beyond one localStorage key, no runtime cost while no gamepad is connected.
