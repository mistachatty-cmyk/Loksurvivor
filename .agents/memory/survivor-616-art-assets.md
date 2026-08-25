---
name: 616 Survivor supplied art
description: How the user's supplied pixel-art files may and may not be shown in the game UI.
---

The user supplied their own pixel-art character sheets and urban scene photos (copied into
`artifacts/survivor-616/public/art/`). These are their artwork, not placeholders — do not
regenerate or replace them with AI art.

**Rule:** the character sheets are working sheets, not portraits. They contain baked-in
annotation text (frame labels, "Weapon Levels 1-8", "WALK", etc.), so they must never be shown
raw in a card or panel. Menus render the character's in-game sprite rig to a canvas instead,
and use the sheet only as a blurred background texture.

**Why:** an early roster pass dropped the sheets in directly and the cards displayed the
sheet's own labels, which read as broken UI.

**How to apply:** any new surface that needs a character likeness should draw the rig rather
than the sheet. Scene photos (street, alley, bar, cellar, rooftops) are clean and can be used
as backdrops directly.

Related standing constraint from the user: do not invent real artists, names, likenesses, or
represent music as licensed. The soundtrack feature only plays files the player picks from
their own device.
