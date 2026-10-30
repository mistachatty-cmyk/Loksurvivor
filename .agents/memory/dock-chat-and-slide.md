# Nav dock, page slide, LOK Chat host (0.42.33–0.42.34)

- **Dock order and swipe order are one list**: `lib/screenSlide.ts` `DOCK_PAGES` (Hideout, Map, Roster, Cards, LokShop, Settings). `MenuDock` takes its `screens` from it. LOK Chat is a dock button, not a page, so it is not in the swipe order.
- **Slide wrapper must never animate a tall page whole.** The card shop is 11,000+ px; a transform on the full page made one giant layer and Safari closed the tab ("Page closed unexpectedly on card-shop", 0.42.33). `ScreenSlide` crops the page to `100dvh` while the 280 ms slide plays, enter-only, and skips it for reduced motion.
- **Pages make room for the dock** through `--menu-dock-h` / `--menu-dock-w`, measured by `MenuDock` with a ResizeObserver and applied as padding on the `ScreenSlide` wrapper. New dock items need no per-page padding.
- **One LOK Chat window**: `ui/LokChatHost.tsx` is mounted in `App.tsx`; open it with `openLokChat()` / `openLokChat('mail')` from `lib/lokChatOpen.ts`. It opens to the mailbox when mail is unread. The floating Mailbox button is gone; `MailboxPanel` lives inside chat.
- **Chat tricks** are records in `game/engine/chatCommands.ts` returning message keys (`lokChat.cmd.*` in `en.json`); `chatCommands.test.ts` fails if a key is missing. Replies are never saved.
- **New Fits** (`musicPlayer.tsx` `NEW_FITS_TRACKS`) is the guest-artist expansion album, open from the start, starting with DJ Misfit's "His Beat". Add a song by adding a file under `public/music/dj-misfit-new-fits/` and a record. It has no `trackNumber`, so it does not get a disc on the arrival shelf yet.

## Overlay and dock correction (0.42.59)

- The menu dock owns both LOK Chat and Crew access. Removed duplicate hideout chat launchers and moved the global Crew button out of the top-right cluster into the dock's launch row.
- `ui/ViewportOverlay.tsx` portals custom dialogs into `#viewport-overlays`, a themed viewport sibling outside animated screens. Shared Radix dialogs/sheets and menu/select/popover/tooltip portals use the same host. Priority inside it: dialogs 200, nested menus 300, tooltips 400. Existing inspectors, forge, crew, discs, pack reveal and soundbar also use this host.
- Run pause/settings/soundtrack/reel and classic level-up overlays use this host. World mirror/invert/colour animation now affects the canvas, so controls and menus remain upright. Phase changes close stale settings/drawers, GUI changes reset auxiliary drawers, and loot reels do not display through pause/settings.
- Run hotkeys ignore input/select/contenteditable targets and other modal dialogs; held pause repeats do not toggle twice. Popup opacity is no longer multiplied a second time for a dialog nested inside its backdrop.
- ScreenSlide removes its animation class at completion, so no dormant animation declaration can retain a screen containing block.
- Regression tests: `e2e/overlay-layering.spec.ts`, with evidence under `docs/previews/scenery-ui/`. Use one Playwright process per output directory; competing runners can delete each other's traces.

- Hub unlock toasts defer while the viewport host has an open overlay; existing timers are cleared and restart on return, so notifications neither overlap dialogs nor expire unseen. Encounter, card/detail, evolution and battle modals also use the viewport host. The mobile regression switches GUI layouts inside paused settings and checks the current panel stays open.

0.42.60: Escape closes paused settings or soundtrack panels even while an input has focus, without resuming the game. LOK Chat now uses `ModalFocus` inside its viewport portal to wrap Tab/Shift+Tab, keep focus out of the dock while open, consume Escape, and restore the actual launcher on close. Capture the opener before focusing the chat input; the old passive-effect ordering could accidentally remember that input as the opener.
