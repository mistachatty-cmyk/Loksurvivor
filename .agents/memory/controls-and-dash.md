---
name: Controls page and PC dash
description: Where player controls live (rebindable keys, controller, touch), how dash is triggered from each input, and the rules that keep rebinding safe.
---

Built v0.22.8.

- `game/input/controls.ts` is the single source: `ControlSettings` (keys, mouse, gamepad, touch), pure
  helpers (`normalizeControls`, `rebindKey/Button` with swap-on-clash, `stickVector`, `padMove`,
  `dashDirection`) and a cached `getControls()` backed by localStorage `survivor616.controls.v1`.
  Tests: `input/controls.test.ts`.
- WASD and the arrow keys are RESERVED, never rebindable, so nobody can lock themselves out of walking.
  `P` still pauses in addition to the bound pause key. A saved file with duplicate keys/buttons is
  discarded back to defaults per `normalizeControls`.
- RunScreen reads `getControls()` on every key press and frame, so Settings changes apply at once
  (the on-screen button visibility is re-read when the in-run settings panel closes).
- Dash: `dashRequestRef` is set by the key, the on-screen `button-dash`, or the controller button, and
  consumed once per rendered frame before the fixed-step loop. Direction = steering, else last move, else
  facing (`dashDirection`). Double-click/tap dash (the older path) is now gated by the mouse/touch switches.
  The HUD carries `dashReadyPct` for the button's cooldown ring.
- Controller: first connected pad; left stick/d-pad steer only when keys/stick/gyro are not; buttons fire on
  press (edge), tracked in `gamepadHeldRef`. Arena mode has its own reader (`arena/arenaInput.ts`), unchanged.
- Settings UI: `SettingsPager` now has Standard | Controls | End game (End game still hidden until earned);
  page is `ui/ControlsSettings.tsx`. Strings are in `en.json` under `controls.*`.

Not done: left-handed touch layout, stick size, rebinding mouse buttons, per-character bindings, playtest on a
real controller (only unit-tested), and an in-run controller button-name overlay.
