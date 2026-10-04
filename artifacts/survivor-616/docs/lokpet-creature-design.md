# LokPet creature design

This is the design brief for what LokPets can be. It exists so any author (human
or AI) adding LokPets knows the range the owner wants, and keeps widening it.

**The standing instruction: add a few more of the unusual ones every once in a
while.** Ordinary animals are fine and expected. The hybrids, fantasy, fictional
and sci-fi creatures are the seasoning: uncommon finds and easter eggs that make a
collector stop and look. Do not let the roster collapse into only dogs and cats,
and do not let it collapse into only weirdness either.

The long-term target is **an effectively infinite roster**, built from a few
hundred authored creatures plus seeded generated ones (see "Infinite roster"). The
near-term milestone is still 200 authored LokPets (roadmap in
`docs/ai-handoff-2026-10-04.md`). Today there are 78 variants on about 41
silhouettes.

The machine-readable version of everything below lives in
`src/game/data/creatureTraits.ts` and is covered by `src/game/creatureTraits.test.ts`.
It is design data and a seeded generator. It is **not wired into battles or chests
yet**, and it never changes a LokPet's combat numbers (those stay bounded by
`data/lokPets.ts`).

## Axes: far more than cute and dread

The first draft had two ratings, **Cute** and **Dread**. They are still the two
players notice first (and `feelLabel` still reads "Adorably terrifying" at 4 and 4),
but a creature is now described on **51 axes in six groups**, each a 0 to 5 value
with a plain-words meaning at both ends. Two creatures with the same Cute and
Dread can feel completely different once Mischievous, Haunting, Mimic or Ancient
are in the picture.

Aim for a spread, not an average. Most axes sit in the middle; the ones that
define a creature are pushed to 0 or 5. `definingTraits` returns the axes furthest
from the middle, which is what a card or detail screen should show.

### Feel (how it lands on a player)

| Axis | At 0 | At 5 |
| :--- | :--- | :--- |
| Cute | Not adoptable | Fits in a hood and in your heart |
| Dread | Perfectly calm | Wrong in a way you feel in your teeth |
| Awe | Ordinary | Stops a crowd |
| Goofy | Dignified | Cannot be taken seriously |
| Cozy | Cold | A warm blanket with legs |
| Forlorn | Cheerful | Looks like it is waiting for someone |
| Uncanny | Natural | Almost right, and that is the problem |
| Charming | Off-putting | Wins any room |
| Grimy | Spotless | Lives in the gutter and loves it |
| Elegant | Clumsy | Moves like a held breath |

### Nature (how it behaves)

| Axis | At 0 | At 5 |
| :--- | :--- | :--- |
| Wild | Tame | Feral |
| Loyal | Aloof | Would follow you into the river |
| Curious | Incurious | Opens every door |
| Mischievous | Earnest | Hides your keys on purpose |
| Brave | Skittish | Charges first, asks later |
| Patient | Restless | Waits out the weather |
| Hot-headed | Unbothered | One bad look from a brawl |
| Hungry | Never eats | Always eating |
| Sleepy | Wired | Naps mid-fight |
| Loud | Silent | Announces itself blocks away |
| Shy | Bold | Hides behind your leg |
| Vain | Humble | Checks every reflection |

### Body (what it is made of)

| Axis | At 0 | At 5 |
| :--- | :--- | :--- |
| Fluffy | Hard-edged | Mostly fluff |
| Armored | Soft-bodied | Plated head to tail |
| Slimy | Dry | Leaves a trail |
| Glowy | Matte | A night light |
| Ghostly | Solid | You can see the wall through it |
| Lopsided | Symmetrical | Nothing matches |
| Ornate | Plain | Covered in detail |
| Ancient | Newborn | Older than the street |
| Oversized | Pocket-sized | Reads as huge even when small |

### Origin (where it comes from)

| Axis | At 0 | At 5 |
| :--- | :--- | :--- |
| Constructed | Organic | Assembled, bolted, wired |
| Cosmic | Earthly | From somewhere with other stars |
| Digital | Analog | Made of addresses |
| Folkloric | Invented | Grandparents tell stories about it |
| Urban | Backcountry | Knows every alley and bus route |
| Elemental | Mundane | Mostly fire, water, storm or frost |
| Aquatic | Landbound | Belongs in the river |
| Subterranean | Skyward | Prefers the dark and the deep |

### Presence (what happens around it)

| Axis | At 0 | At 5 |
| :--- | :--- | :--- |
| Omen | No portents | Something happens when it shows up |
| Lucky | Unlucky | Finds things |
| Hoarder | Gives it all away | Keeps a stash |
| Mimic | Itself only | Copies what it sees and hears |
| Haunting | Stays put | Follows you at a distance |
| Performer | Never performs | Needs an audience |

### Combat style (how it plays, never how strong)

| Axis | At 0 | At 5 |
| :--- | :--- | :--- |
| Ferocity | Gentle | Savage |
| Guard | Exposed | Takes the hit for you |
| Nimble | Plodding | Never where you aimed |
| Supportive | Selfish | Patches the team up |
| Trickery | Straightforward | Wins by cheating |
| Reach | Up close | Strikes from across the block |

Adding an axis is one row in `AXES`. Nothing else needs to change, because the
generator, the themes and the quirks only name axes by id and the tests check the
ids exist.

## Quirks

A quirk is one small, specific detail ("too many eyes", "wears a tiny hat", "its
reflection does something else", "sings at night in a human voice") that nudges a
few axes and gives two similar creatures a different feel. There are 46 in
`QUIRKS`. Each shifts named axes by a small amount (clamped to 0-5). Higher tiers
carry more of them.

## Themes: drawn from the game's factions and districts

A theme sets which axes a creature leans toward, which quirks and body plans it
favors, and the words its generated names start with. Most themes are one of the
game's own factions (the `faction` id is checked against `data/factions.ts` by the
tests), so a creature can be an Afterimage Choir thing, a Lev Syndicate nest-mate
or a Firefly Hollows glowworm. The last few are place-based.

| Theme | Faction id | In-world blurb |
| :--- | :--- | :--- |
| River Antler Court | river-antler-court | Floodwall wildlife, running sideways through the street grid. |
| Neon Arcade | cabinet-rot | Cabinets glitching back to life with nothing plugged in. |
| Null Sector | null-sector | A data-center basement where nothing is plugged in and everything runs. |
| Arbor Collective | arbor-collective | Bio-digital canopy growth with a firewall. |
| Lev Syndicate | lev-syndicate | Skyway cartel machines and the things that nest in them. |
| Firefly Hollows | firefly-wranglers | Underground prospectors, incandescent fireflies and the dark between. |
| Haven of the Bubs | bubblenaught-tide | Surfactant globes, fluid shields and an unreasonable amount of foam. |
| Afterimage Choir | afterimage-choir | Shadow-born things seen from the corner of the eye. |
| Cinder Procession | cinder-procession | Armored chargers and the fire on the east side that never went out. |
| The Reel Syndicate | reel-syndicate | The Director's crew and the creatures they keep on set. |
| High Roller Syndicate | high-roller-syndicate | The Neon Overflow stock room, dressed for the occasion. |
| Data Goblins | data-goblins | Small, green and chewing on anything already broken. |
| Supabuilda | supabuilda | A gym faction. Everything is a rep if you commit. |
| The Site Crew | the-site-crew | Active work zones with wildlife that learned to wear a hard hat. |
| The Watch | the-watch | Sentries that sweep for movement. |
| Prism Choir | prism-choir | Color-coded beacons that pull, slow or burn. |
| Glitch Breach | glitch-breach | Rendering bugs that broke free of the engine. |
| Digitized Damned | digitized-damned | Harvested survivors, fragmented into data and still faintly themselves. |
| Lockstep | lockstep | Cones that lock on and narrow to a line. |
| Great Lakes folklore | district / local | Stories the grandparents tell about the water and the woods. |
| Visitors | district / local | Not from around here. Not from around anywhere. |
| Back Alley | district / local | The ordinary city strays: loud, scruffy, and fully at home. |

A creature can have more than one theme (a Great Lakes folklore creature that
also belongs to the River Antler Court). Add a theme as one row in `THEMES`.

## Body plans

48 silhouettes in four kinds: everyday (27 real animals), fantasy (dragon,
griffin, unicorn, phoenix, kraken, golem, basilisk, wisp, sprite), folk (dogman,
lake serpent, river spirit, scarecrow, jackalope, lantern ghost) and sci-fi (drone,
nanite flock, gravity jelly, tardigrade, mimic box, probe). A creature has one
plan and, with a chance, **borrows parts from a second plan** (a hybrid). Plan ids
are the keys for the future body-plan recipes (roadmap phase 1); only some exist
as art today.

## Rarity has two separate ladders

The owner asked for rarity to mean two things, the way a legendary or mythical
creature is both harder to meet and a different kind of creature. They are
independent, so a creature has one value on each.

**Findability: how often you run into it.** Pure encounter rate.

| Findability | Relative weight | Hint before meeting it |
| :--- | :--- | :--- |
| Ubiquitous | 3000 | A full tip |
| Common | 1800 | A full tip |
| Uncommon | 800 | A good hint |
| Scarce | 320 | A good hint |
| Rare | 120 | A vague hint |
| Elusive | 40 | A vague hint |
| Hidden | 8 | None. Never listed in any hint. |

**Tier: how remarkable it is.** Standing and story, not raw power. Higher tiers
have more extreme traits, more quirks, grander names, and a limit on how many can
exist in one save.

| Tier | Share | Extreme axes | Quirks | Name style | Max per save | Can be traded or rerolled |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Wild | 60% | 0 | 0-1 | "Shy Heron" | no limit | yes |
| Notable | 25% | 1 | 1-2 | "Gutter Otter" | no limit | yes |
| Exalted | 10% | 2 | 2-3 | "Pale Stag the Unlit" (epithet) | no limit | yes |
| Fabled | 4% | 3 | 3-4 | "Marrow, Warden of the River Antler Court" | 12 | yes |
| Mythic | about 1% | 4 | 4-5 | A title, as above | 3 | no |
| Singular | about 0.1% | 6 | 5-6 | One proper name | 1 | no |

Because the ladders are independent: a **Mythic** can be **Common** (a legend that
simply lives in your neighborhood), and a **Wild** pigeon can be **Elusive** (an
unusually shy one). The collector's thrill is the cross between them, not a single
"rare" label. The test suite checks both combinations really occur.

Nothing in tier or findability changes combat stats. If a higher tier should be
stronger, change `data/lokPets.ts` bounds deliberately, not here.

## Infinite roster

A creature is a **seed**. `rollCreature(seed, options)` is a pure function: the same
seed always gives the same creature (plan, hybrid, themes, tier, findability,
quirks, all 51 trait values and its name), so nothing but the seed needs saving
and the roster has no upper bound. Ten thousand seeds give about ten thousand
distinct creatures, which a test checks.

Three sources feed the one roster:

1. **Authored creatures**: the roughly 200 hand-made, canonical ones (named,
   with fixed art and lore). These are the landmarks.
2. **Seeded creatures**: generated forms rolled from a seed. Good for the long
   tail, daily visitors, chest pulls and "a stranger followed you home". An author
   can promote a seed whose roll turned out delightful into an authored creature
   by freezing its record.
3. **Player-made creatures**: see "Your own art" below.

Options let a place or event steer the roll (`themes`, `plan`, `tier`,
`findability`, `hybridChance`) without breaking determinism.

## Your own art (design, not built yet)

The owner wants players to eventually bring their own drawn art and body parts
into the game and customize their own character with their own files. The design
that fits what already exists:

- **Import format.** A small PNG (pixel art, up to 64 by 64) per part, or one PNG
  sheet with a simple slot map. The importer converts each image to the same
  `SpritePart` rectangles every procedural rig uses, merging runs of same-colored
  pixels so a part stays a few dozen rectangles. Nothing new is needed in the
  renderer.
- **Slots.** Parts map to the existing rig part keys (head, torso, arms, legs,
  tail, crest and the detail keys the Forge uses) so the idle, walk, attack and
  hurt clips move imported parts for free.
- **Limits.** A cap on image size, parts per rig and total rectangles, so an
  import can never stall the renderer. Colors outside the 7-key palette become
  literal hex colors through an additive optional `hex` on a part; authored
  parts never use it.
- **Storage.** Local only (IndexedDB), like the Forge's saves. No upload, no
  sharing and no moderation surface by default. A share code for art would need
  its own review before it ships.
- **Ownership.** The importer asks the player to confirm the art is theirs or
  that they are free to use it. The game never fetches or hosts anyone's art.
- **Where it plugs in.** First as custom parts and a custom skin inside the
  Operator Forge custom slots (so it is additive and never replaces a premade
  operator), then as a custom LokPet body once body-plan recipes exist.
- **Not the same as reference art.** The rule that supplied reference art in
  `public/art/` is never shown raw (see `.agents/memory/survivor-616-art-assets.md`)
  is about art given to the developers. Art a player imports for their own
  character on their own device is theirs to show, and is shown as what they made.

## Tiers of kind (the original brief)

Separate from rarity tier above, this is the *kind* of creature, which sets what
share of the roster each family should be:

| Kind | What it is | Share of a 200 authored roster |
| :--- | :--- | :--- |
| Everyday | Real animals: dog, cat, bird, fish, reptile, insect, small mammals. | about 110 |
| Odd | Hybrids of two real animals (owl-raccoon, moth-cat, frog-crab, deer-heron). | about 40 |
| Fantasy | Dragons, griffins, unicorns, kraken pups, phoenix chicks, basilisks, golems. | about 25 |
| Fictional and folklore | Original inventions plus regional folklore (Great Lakes and Michigan legends: a dogman-type, lake monsters, a Rapids river spirit). | about 10 |
| Sci-fi | Constructs and aliens: nanite swarms, gravity jellies, drone-hounds, tardigrade-bots, vending-machine mimics. | about 10 |
| Easter egg | Any of the above gated behind something odd: a time of day, a song playing, a district, a rare roll, a hidden hideout interaction. | about 5 |

These shares are a guide, not a quota. Phase them in; do not build 90 odd
creatures before the 110 everyday ones exist.

## Rules

1. **Original designs only.** No creatures, characters or mascots from existing
   games, shows or franchises, and no lookalikes of them. Folklore and public
   domain myth are fine. Reference art and supplied sheets are inspiration only and
   are never shown raw (see `.agents/memory/survivor-616-art-assets.md`).
2. **Procedural art.** LokPets are built from body-plan recipes drawn on Canvas2D,
   not bitmaps. A hybrid is a body plan plus a part set from another plan, not a
   new hand-drawn sprite. (Player imports are the one deliberate exception, and
   they are converted to the same rectangles.)
3. **Gameplay must read at a glance.** A creature's silhouette and palette should
   suggest its element and attack. A terrifying pet that plays like a plain
   "single shot" pet is a missed chance; a fire-breathing one should look it.
4. **Rarity is not power.** Findability and tier control how often you find it
   and how remarkable it is. The stat sheet bounds in `data/lokPets.ts` still apply.
5. **Cute and dread are both valid.** Do not sand every scary creature down to
   friendly, and do not make every cute one secretly dark.
6. **Never use the banned word** in names, ids, copy or docs (see `CLAUDE.md`).
   Use `beacon`, `pulse`, `relay`, `static` or an original word. The trait tests
   check every string in the trait data.

## Record fields (when authored creatures become data)

Each authored creature should be able to answer:

- `id`, `name`, `kind`, `tier` and `findability`
- `plan` and, for hybrids, the borrowed `partsFrom`
- `themes`, `quirks`, and trait values (at least the defining axes)
- `element` and attack mode, so the look matches the play
- `habitat`: which district or condition it appears in
- `foundBy`: how it is obtained (chest pool, condition, easter egg trigger)
- `flavor`: one line of lore in the voice of the game

The seeded `CreatureGenome` already has `seed`, `name`, `plan`, `partsFrom`,
`themes`, `tier`, `findability`, `traits` and `quirks`.

## Seed ideas (a backlog, not a commitment)

Cute: moss-furred hedgehog with a lantern fruit, a pillow-shaped moth, a duck
wearing a paper boat, a sleepy lake otter-eel, a tiny thunderhead fox.

Both cute and terrifying: a kitten with a second mouth under its chin, a
goldfish in a glass bowl that walks on spider legs, a bunny whose ears are
speakers, a balloon-animal that remembers being a person, a lamb with a ring of
small eyes.

Terrifying: a heron-legged streetlight that follows you home, a deer skull
carrying a candle, a drain-dwelling eel with a human smile, a stack of dust mites
wearing a coat, a river spirit made of shopping carts.

Fantasy: a pocket dragon that hoards bottle caps, a griffin cub (owl and bobcat),
a unicorn foal with a traffic-cone horn, a kraken pup that lives in a fountain, a
phoenix chick that restarts when startled.

Sci-fi: a gravity jelly that bends dropped coins, a drone-hound with a pulse tail,
a tardigrade in a tiny armored shell, a vending-machine mimic, a nanite flock
shaped like a starling murmuration.

Easter egg ideas: a creature that only appears when a certain track from the
player's own library plays, one that shows up in the hideout at 3:16 in the
morning, one that follows a pet you already own, one that appears only if you do
nothing for a full minute in a district.

## Added log

Add a line here every time you add creatures or widen the trait model, so the next
author can see the pace and keep widening the range. Suggested cadence: two to
four odd or fantasy creatures most updates, and one easter egg every other update.

| Date | Version | Added | Kind or area | Notes |
| :--- | :--- | :--- | :--- | :--- |
| 2026-10-04 | 0.10.8 | Brief written; no creatures added yet. | n/a | Two axes: cute and dread. |
| 2026-10-04 | 0.10.9 | Trait model: 51 axes, 46 quirks, 22 themes (19 faction-linked), 48 body plans, findability and tier ladders, seeded generator, import design. | model | Data and tests only; not wired into battles or chests. |
