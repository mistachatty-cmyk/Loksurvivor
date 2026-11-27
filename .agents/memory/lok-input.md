# Lok input and Game Mode

- Browser gaming overlays can steal keyboard focus, so arrows did nothing on the board. Fix: shared action layer in `src/lib/lokInput/` (keys and gamepad become the same actions), claimed on keydown in capture phase, focus dropped.
- Game Mode is `src/lib/gameMode.ts` plus `GameModeButton`: in-app fullscreen with a visible Exit; Esc is never mapped so browsers can leave fullscreen.
- The input pad (mouse, keyboard, gamepad) is draggable, lockable, persisted in `lokinput.v1`, quiet blip + pop ring on switch. Using a device auto-switches the pad to it.
- Rule: nothing in `src/lib/lokInput` imports from the game (test-enforced); the plan to extract it as `@lok/input` is `docs/LOK_INPUT_PLAN.md`.
- Every Lok game reacts to actions on press, never raw key codes.
