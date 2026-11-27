# Brief for Gemini: invent Lok Party minigames

Paste everything below the line into Gemini.

---
I am designing minigames for "Lok Party", a Mario Party-style mode in a browser game. Please invent 8 minigame ideas, from safe to crazy, that a single developer can build cheaply.

Hard constraints for every idea:
- 30 seconds long, 4 players: 1 human plus 3 bots, same seed on every device.
- One input family only: move or lane-change plus one action button. Must work with touch (swipe and tap), keyboard, and gamepad.
- Deterministic: the whole game is a pure function of a seed and the inputs, so bots can be simulated and an online friend sees the same arena.
- Procedural art only: shapes, gradients, particles drawn on a 2D canvas. No images, no sprite sheets, no 3D.
- Must be readable in 2 seconds with one line of instructions, and feel good: hit-stop, screen shake, chimes, a visible score chain or multiplier.
- Ends with a clear placement 1 to 4 and a numeric score per player.
- No network, no AI at runtime, no emoji.

Existing games (do not repeat): Ring Run Rush (auto-run lanes, collect rings, jump hazards) and The Lok Drop (arena dash-and-collect).

For each idea give: name, one-sentence pitch, controls, what bots do and how difficulty (0 to 1 skill) changes them, how the winner is decided, the "juice moment" that makes it feel great, and a build-cost guess (small, medium, large). Include at least two wild ideas inspired by Mario Party chaos: shifting arenas, steal mechanics, last-one-standing, rhythm, and a final-round twist where the leader is handicapped.
