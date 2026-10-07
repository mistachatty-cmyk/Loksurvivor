# Crew dialogue generator — Rant as the reference

Status: **built (v0.19.2); handoff and expansion ideas in `docs/CREW_CHATTER.md`.** `engine/crewTalk.ts` (expander), `engine/crewSpeak.ts` (context glue), `data/crewVoices.ts` (a voice record per ally + shared pools), `state/crewTalkSetting.ts` (device-local mode/tone), `crewTalk.test.ts`. Fragments are inline English in the data file, like ally blurbs, not en.json keys (thousands of fragments); only the settings labels are in en.json. Original design notes follow. Special directions and communications
for individual characters will be added by the user later; leave a slot for them.

Goal: rescued crew standing in hideout rooms (see `HubScreen.tsx`, props with id
`ally:<id>`) can say a practically unlimited number of lines when you walk up to
them, instead of the single `AllyDef.blurb`. Each line must sound like *that*
character.

## Reference repo

<https://github.com/rant-lang/rant> (Rant 4, `4.0.0-alpha.33`, MIT/Apache-2.0).
"A templating language designed primarily for procedural generation… procedural
dialogue, character generation, and worldbuilding." Docs: <https://docs.rant-lang.org>.
Worth reading in the clone: `examples/personality.rant`, `examples/weighting.rant`,
`examples/harvard-sentences.rant`, `examples/modules/`.

Rant is Rust and alpha ("do not use in production"). **Do not add it as a
dependency.** Borrow its ideas and implement a tiny TypeScript expander in
`src/game/engine/` (pure, seeded with `createRng` from `engine/math.ts`, never
`Math.random`, so a line can be reproduced and tested). Only revisit the Rust/WASM
build if the TS version outgrows its needs.

### Rant ideas worth copying

| Rant idea | Syntax | How we use it |
| --- | --- | --- |
| Random choice block | `{Hello\|Hi\|Hey}` | every phrase has alternates |
| Weighted branch | `[weight:3]` per branch | favor a character's signature phrasing |
| Named variables / subroutines | `[$greet:name] {…}` / `<name>` | reusable fragments: `<place>`, `<food>`, `<weather>` |
| Selectors (match/sync) | `[sel:…]`, synced blocks | keep two choices consistent ("morning … breakfast") |
| Repeater / separator | `[rep:3][sep:\s]` | chain two or three clauses |
| Auto capitalization, whitespace normalize | built in | no hand-fixing sentence starts |
| Seedable RNG | seed the context | same seed, same line; tests stay stable |
| Modules (`@require`) | one file per concern | one pool per character + shared pools |

A line template in our TS format could look like this (final syntax is open):

```
{Mind the <hazard>.|Heard the <hazard> again last night.|Not a great day for <activity>, but here we are.}
{ Eat something.|} {Stay close to <ally>.|}
```

Slots (`<hazard>`, `<activity>`, `<food>`, `<ally>`…) come from shared pools plus
per-character pools; `<ally>` resolves to another rescued crew member's name.

## Per-character voice

Generate from **that character's type**, not from a generic NPC bank. A voice
profile per `AllyDef.id` (data, not engine code; same "add a record" rule as the
rest of the game):

- `voice`: 2–3 sentence description plus signature phrases and verbal tics.
- `topics`: pools they like (e.g. food, records, paint, cameras, bells, tools).
- `rooms`: lines keyed to the room they stand in; the hideout room list is in
  `data/progression.ts` (`HUB_ROOMS`).
- `moods`: tied to run state (just back from a run, lost run, long idle, late
  at night, rainy) so repeats feel situational.
- `knows`: other crew they talk about by name.
- `special`: **reserved** for the user's later directions/communications; keep
  the schema open, do not invent content for it.

Starting points from the existing blurbs (do not copy them verbatim, expand
them): `vee` variety-store keeper who knows every alley; `deacon` rings the hour,
rigged a loud door; `nyx` skyline painter; `sable` records and the sound system;
`mamajo` feeds everyone, cast-iron pan; `bulbosa` blue-and-pink kingdom heir;
`morrow` long-exposure photographer of safe routes; `cinder` turns motors into
barricades; `pippa` knows who needs a hot meal.

## Content rules (adult-aware, kid-safe)

The tone can be wry, tired, flirty-at-most-in-a-wink, world-weary, sarcastic,
and honest about a rough city. It must still be fine if a child is looking at
the screen.

- No profanity (including masked versions), slurs, sexual content, graphic
  violence, gore, drug or alcohol use as a punchline, or real-world politics and
  religion.
- Danger and loss are allowed in a gentle register ("the city took the lights
  again", never a description of injury).
- Innuendo that needs a second reading is out. If in doubt, cut it.
- Never fabricate real people, brands, or artist/licensing claims
  (`survivor-616-art-assets.md`).
- **Never use the word "signal"** (CLAUDE.md naming rule). Use beacon, pulse,
  relay, static, frequency.
- Player-facing strings live in `src/locales/en.json` (typed keys, never edit
  the other language files). A procedural fragment pool is a list of keys, so
  the Auto-translate action can handle it; invented nouns go in
  `l10n.config.json` `glossary`.

## Anti-repetition and "infinite"

Combinatorics gives the volume (a handful of openers × topics × closers × slot
fills per character is thousands of lines). To keep it from feeling repetitive:

- Remember the last N rendered lines per ally (session memory, not saved) and
  re-roll on a match.
- Weight pools by room, time of day, weather, and the last run result.
- A small share of lines should be one-off "rare" lines that reference a recent
  event (rescue, level up, new pet) so the voice has some memory.

## Tests to add when built

- Every template parses, every slot has a pool, every pool is non-empty.
- A banned-word list test over every rendered fragment (profanity list plus
  `signal`), run across many seeds per character.
- Same seed gives the same line; different seeds give different lines.
- Every `AllyDef` has a voice profile.

Update this note when the generator exists, and when the user supplies the
special directions.
