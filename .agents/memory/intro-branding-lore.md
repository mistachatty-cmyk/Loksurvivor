# Intro screen branding and the "616" lore hook

## What changed and why

The cold-open title screen (`src/ui/IntroScreen.tsx`) previously read "616 /
Survivor" (two lines, in that order) with a static "Grand Rapids · 616" tag
above it, a body paragraph of flavor text, and no external credit. The user
settled on **Survivor616** as the game’s official name. “616Survivor” and
other 616/survivor permutations are playful alternate lockups, not a
rebrand. The attract-mode background, centered layout, and framer-motion
fade-ins stay as-is.

- The signature layout renders `Survivor` and `616` as two pieces of one
  **Survivor616** lockup: “616” is a compact lower-right badge so the name
  feels deliberate instead of cramped. The classic stacked layout remains
  selectable as the alternate presentation.
- The title pieces can be dragged on touch or pointer devices with gentle
  release momentum. This is on by default, can be disabled in Settings, and
  always has a subtle reset control after the title has moved. Positions are
  session-only, so reloads never leave the title in an awkward place.
- The body paragraph ("The block turned after dark...") was removed
  entirely, not replaced.
- A small external credit link was added below the "Enter the hideout"
  button: "Powered by LokServices · Designed by GSixDesigns", linking out to
  `https://gsix.online` (`target="_blank" rel="noopener noreferrer"`, plain
  `<a>`, no router involved since it's a genuine external site).
- The "Grand Rapids · 616" location tag now cycles: it shows
  `LOCATION_TAG_MAIN` ("Grand Rapids · 616") almost all the time, and every
  `LOCATION_TAG_ALT_INTERVAL_MS` (26s) fades via `AnimatePresence` to
  `LOCATION_TAG_ALT` ("A grand display of digital rapids") for
  `LOCATION_TAG_ALT_DURATION_MS` (4s) before fading back. Deliberately
  mostly-one/occasionally-the-other, not a 50/50 rotation -- tune the two
  duration constants directly if the cadence needs to change, don't add a
  third state.

## The lore reason, for future world-building

Per the user: Grand Rapids is their home city, and "616" is meant to read as
this world's "center of the universe" -- a nod to the numbered-Earth
multiverse convention where a franchise's flagship continuity gets a
distinguishing number (their own point of reference: Marvel's Earth-616).
That's the intent behind the alternate location-tag line and behind
`CLAUDE.md`'s framing of the game as set in "a fictionalized Grand Rapids
('616')". Future world-building (lore text, area flavor, NPC dialogue) can
lean into "616 as the center of the universe" as an established idea.

**Never put "Marvel" or "Earth-616" by name into shipped game copy.** The
inspiration is real but the terms are someone else's trademark; the game's
own vocabulary is "616" / "Survivor616" / "the center of the universe" and
should stay there, the same way `survivor-616-art-assets.md` already
establishes that this project never fabricates real licensing claims.
