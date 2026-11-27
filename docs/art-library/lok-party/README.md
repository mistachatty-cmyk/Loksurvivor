# Lok Party visuals

Screens and mockups made in chat for Lok Party, filed so they can be referenced instead of recreated.

| File | What it is | How it was made |
| --- | --- | --- |
| `vault-A-shelf.png`, `vault-B-list.png`, `vault-C-workbench.png` | Three vault screen layouts for the owner to pick from (2026-11-27). Not built yet. | `vault-mockups.py` writes three HTML pages; headless Chrome (Playwright, 390x760 at 2x) screenshots them. Icons are rough stand-ins. |
| `ring-run-rush.png`, `ring-run-rush-podium.png`, `ring-run-rush-entrance.png` | Ring Run Rush in play, its podium, and the shared entrance. | Screenshots of the real game (`src/party/RingRushArena.tsx`) in headless Chrome at 390x844, 2x. |
| `roof-rumble-entrance.png`, `roof-rumble-play.png`, `roof-rumble-podium.png` | Roof Rumble: the entrance lineup with the 3-2-1, a fight with a boom barrel, and the podium. | Screenshots of the real game (`src/party/roofRumbleArt.ts` via `MinigameStage.tsx`) in headless Chrome at 390x844, 2x. |
| `roof-collapse-cracking.png`, `roof-collapse-after-drop.png` | Roof Collapse: the outer ring cracking (flashing red), and the next ring cracking after the first dropped. | Screenshots of the real game (`roofCollapse` in `src/party/roofRumbleArt.ts`) in headless Chrome at 390x844, 2x. |
| `roof-collapse-countdown.png`, `roof-collapse-ring-drop-sequence.png`, `roof-collapse-last-rings.png` | v0.42.98 Roof Collapse: the ring countdown banner, pips, gold safe line and touch DASH button; five frames across a ring drop (slam banner, chunks tumbling); the roof down to its last rings. | Headless Chrome emulating a touch phone (390x844, 2x); the sequence is five frames 120 ms apart combined into one sheet with Pillow. |
| `controller-focus-and-screen-button.png` | v0.42.99: the title screen on a simulated Xbox (lighter graphics), the corners-only full screen button top right, with the controller's gold focus highlight on it. | Headless Chrome with an Xbox user agent and a fake controller, 1280x720. |

All in-game art is procedural Canvas2D; characters are their own rigs.
