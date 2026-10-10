# Hideout crew life (v0.24.7) and double-click dash (v0.24.8)

Crew on the hideout strip used to be fixed props with a rare, minutes-apart shuffle, and every note
(crew speech, prop results) went into one DOM box pinned over the bottom of the strip, i.e. on
everyone's feet. Both changed.

## Behavior contract

- `engine/hideoutCrewLife.ts` is the pure rule set; `data/crewTemperaments.ts` is the data. A crew
  member is a `CrewActor` with a `CrewTemperament` (speed, roam, restless, social, curious, shy, busy,
  bounce, cadence). Personality is shown in motion, not text. A new ally needs a row in
  `CREW_TEMPERAMENTS` (the unit test fails without one); cameo NPCs fall back to the calm default.
- Behaviors: stand, pace, tinker, lookout, visit (walk to a room prop and use it), chat (walk over to
  another crew member, alternate lines), approach/retreat (greeting you, by curiosity/shyness), talk
  (you tapped them), dance (jukebox), react. Everything is cosmetic: crew never claim rewards; only the
  player's operator pays out through `engine/hideoutRewards.ts`.
- Crew lines come from `crewSpeak` (voices in `data/crewVoices.ts`), supplied to the strip through the
  `crewSpeak` prop. Chatter waits (`quiet`) while a note the player triggered is showing.
- Home spots are fractions along the walking range (`homeFrac`), so a resize rescales positions instead
  of teleporting them (`syncCrew`). Tapping/using a crew member targets where they are now, not their spot.

## Speech and notes

- Crew speech and anchored notes are drawn on the canvas by `ui/hideoutBubble.ts` (pure `layoutBubble`:
  above the head when there is headroom, otherwise beside it, always clamped inside the strip, nudged
  clear of bubbles already placed). The strip is only ~176px tall and sprites fill most of it, so side
  placement is the common case.
- `StripNotice.anchor` (`operator`, a prop id, `pet:<id>`) turns a note into a bubble; without an anchor
  it is the small corner note, now at the top of the strip. Pet events deliberately stay the corner note
  (`data-testid="hideout-pet-event"`, e2e depends on it). Canvas speech is mirrored into a visually
  hidden `role="status"` (`hideout-spoken`) so screen readers still hear it.

## Props

- `drawProp` takes `useAge` (progress 0..1 of the "just used" reaction): bell shakes, crate lid pops,
  lamp flares, door opens, jukebox pulses, plus a ring and floating glyph. The Lucky Chest has its own
  `chest` art (it used to be a copy of the relay crate). Using a prop also makes the operator hop (or sit,
  on the window seat) and `reactToProp` makes nearby crew look over; a jukebox sets them dancing.

## Verifying

- Pure rules: `hideoutCrewLife.test.ts`, `hideoutBubble.test.ts`. Browser: `e2e/hideout-crew-life.spec.ts`.
- Visual check: seed a save with `rescuedAllyIds` and open `/?screen=hub`, as in the e2e specs.

## Double-click dash

- Two taps within `DASH_DOUBLE_TAP_MS` and `DASH_DOUBLE_TAP_PX` turn the operator's walk into a dash
  (`startDash` in `engine/hideoutWalk.ts`, speed `OPERATOR_DASH_SPEED`, short cooldown). It reuses the in-run
  settings (`getControls().mouse.doubleClickDash` / `.touch.doubleTapDash`), works on props and crew
  (dash to their standing spot, then use them), and never runs under reduced motion. A new goal or a held
  key ends it. The strip draws afterimages, speed lines and a dust kick-off.
