# Menu mini-games (concept, not built)

Small playable things that live inside the main menu and hideout, so opening the game is already a little fun. Status: **concept only**; nothing here is built yet. Owner asked for this on 2026-11-28 while the customization drive (themes first) continues.

## Rules every mini-game follows
- **Tiny and skippable.** A session is under 30 seconds. Nothing blocks the menu; they are idle toys, never a gate.
- **Procedural art only** (see `LOK_COST_DISCIPLINE.md`): Canvas2D or CSS, no images, no network, no runtime LLM calls.
- **Rewards go through `engine/hideoutRewards.ts`** (daily caps, rare limits). Idle prompts are a chip on the strip, never a pop-up.
- **Reduced motion and power-save** variants are mandatory; every control has hover, press, disabled and busy feedback and an aria-label.
- **Portable.** Each toy is a pure-data descriptor (`id`, `title key`, `reward kind`, `palette ids it can unlock`) plus a renderer, so the same toy can be mounted in another Lok app.
- **No emoji or system symbols.** Original glyph art only.

## First ideas, in the order they are worth building
1. **Palette Lab (themes first).** A tabletop in the hideout where you drag two owned palettes together and watch a live preview of the blend on your fighter. Saving a blend as a "Lab theme" is a free-shelf item with a daily cap. Uses the existing palette data, so it is the cheapest and fits the current focus.
2. **Chalk Wall.** Draw on a brick wall behind the title with your finger or mouse; the chalk dust glows in the colors of your equipped theme. Finishing a recognizable shape (star, bridge, horse) drops a small chalk-themed palette.
3. **Dial Tone.** Tap a seven-key keypad in rhythm with the title music. A clean run lights the menu in the theme's glow for the session.
4. **Vending Claw.** A one-credit claw machine stocked with hats and celebrations you do not own yet. Daily cap; duplicates convert to dust.
5. **Rooftop Constellation.** Connect the stars of the Constellation effect by hand to unlock a night-sky theme.
6. **Puddle Stomp.** Menu rain collects in puddles; stomping one makes rings in the Rain effect colors. Pure feel, no reward.

## Open questions (defaults marked PROPOSED)
- Where do they live: a "Toys" shelf in the hideout, or loose on the title screen? **PROPOSED:** a Toys shelf in the hideout, with the Chalk Wall behind the title only.
- Do Lok Pass or Passport holders get extra daily attempts? **PROPOSED:** no, keep it fair; they get exclusive toy skins instead.
- Which toy first? **PROPOSED:** Palette Lab.
