# Online lobby: QR join card and game options drawer (v0.43.8)

`qr-and-options-drawer.png`: the always-on "Scan to join" card (QR of the room link, made on the device with no network) above the Game options drawer, shown collapsed (one quiet line naming the goal) and open (goal and length chips in a short scrolling panel). The chevron is a drawn SVG, not a symbol character.

How it was made: a temporary page rendered the real `QrCode` (src/ui/QrCode.tsx) and the exported `OptionsDrawer` (party/PartyLobby.tsx) with the app stylesheet, clicked the second toggle, and was captured with headless Chrome at 420x640. The page was deleted afterwards.
