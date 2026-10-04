# LokPet creature design

This is the design brief for what LokPets can be. It exists so any author (human
or AI) adding LokPets knows the range the owner wants, and keeps widening it.

**The standing instruction: add a few more of the unusual ones every once in a
while.** Ordinary animals are fine and expected. The hybrids, fantasy, fictional
and sci-fi creatures are the seasoning: uncommon finds and easter eggs that make a
collector stop and look. Do not let the roster collapse into only dogs and cats,
and do not let it collapse into only weirdness either.

The long-term target is 200 LokPets (see the roadmap in
`docs/ai-handoff-2026-10-04.md`). Today there are 78 variants on about 41
silhouettes.

## The two axes: cute and terrifying

Every creature gets two ratings from 0 to 5, written into its record or notes:

- **Cute**: how much a player wants to adopt it.
- **Dread**: how much it unsettles them.

Aim for a spread, not an average. Some should be pure cute (a fluffy thing that
fits in a hood), some pure dread (too many eyes, wrong joints), and the most
memorable ones are both: adorable and slightly horrifying at once. A pet at 4 cute
and 4 dread is usually the best easter egg.

## Tiers

| Tier | What it is | Share of a 200 roster | How it shows up |
| :--- | :--- | :--- | :--- |
| Everyday | Real animals: dog, cat, bird, fish, reptile, insect, small mammals. | about 110 | Common to rare, the normal chest pool. |
| Odd | Hybrids of two real animals (owl-raccoon, moth-cat, frog-crab, deer-heron). | about 40 | Uncommon. A hybrid takes one body plan and borrows parts from another. |
| Fantasy | Dragons, griffins, unicorns, kraken pups, phoenix chicks, basilisks, golems. | about 25 | Uncommon to rare. |
| Fictional and folklore | Original inventions plus regional folklore (Great Lakes and Michigan legends are good fits, e.g. a dogman-type, lake monsters, a Rapids river spirit). | about 10 | Rare. Local flavor is welcome. |
| Sci-fi | Constructs and aliens: nanite swarms, gravity jellies, drone-hounds, tardigrade-bots, vending-machine mimics. | about 10 | Uncommon to rare, and a natural home for Lev Syndicate and Null Sector flavor. |
| Easter egg | Any of the above gated behind something odd: a time of day, a song playing, a district, a rare roll under 3%, a hidden hideout interaction. | about 5 | Hidden. Never listed in a "how to find" hint. |

These shares are a guide, not a quota. Phase them in; do not build 90 odd
creatures before the 110 everyday ones exist.

## Rules

1. **Original designs only.** No creatures, characters or mascots from existing
   games, shows or franchises, and no lookalikes of them. Folklore and public
   domain myth are fine. Reference art and supplied sheets are inspiration only and
   are never shown raw (see `.agents/memory/survivor-616-art-assets.md`).
2. **Procedural art.** LokPets are built from body-plan recipes drawn on Canvas2D,
   not bitmaps. A hybrid is a body plan plus a part set from another plan, not a
   new hand-drawn sprite.
3. **Gameplay must read at a glance.** A creature's silhouette and palette should
   suggest its element and attack. A terrifying pet that plays like a plain
   "single shot" pet is a missed chance; a fire-breathing one should look it.
4. **Rarity is not power.** Rarity controls how often you find it and how
   remarkable it is. The stat sheet bounds in `data/lokPets.ts` still apply.
5. **Cute and dread are both valid.** Do not sand every scary creature down to
   friendly, and do not make every cute one secretly dark.
6. **Never use the banned word** in names, ids, copy or docs (see `CLAUDE.md`).
   Use `beacon`, `pulse`, `relay`, `static` or an original word.

## Record fields (when these become data)

Each non-everyday creature should be able to answer:

- `id`, `name`, `tier`
- `bodyPlan` and, for hybrids, the borrowed `partsFrom`
- `cute` (0-5) and `dread` (0-5)
- `element` and attack mode, so the look matches the play
- `habitat`: which district or condition it appears in
- `foundBy`: how it is obtained (chest pool, condition, easter egg trigger)
- `flavor`: one line of lore in the voice of the game

Until body-plan recipes exist (roadmap phase 1), keep these as notes in the
"Added log" below so nothing is lost.

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

Add a line here every time you add creatures, so the next author can see the pace
and keep widening the range. Suggested cadence: two to four odd or fantasy
creatures most updates, and one easter egg every other update.

| Date | Version | Added | Tier | Cute / Dread |
| :--- | :--- | :--- | :--- | :--- |
| 2026-10-04 | 0.10.8 | Brief written; no creatures added yet. | n/a | n/a |
