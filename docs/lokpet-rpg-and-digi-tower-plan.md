# LokPet RPG, Bonds, Hideout Companions and the DIGI-Tower: plan

Status: **plan only, nothing built yet.** Written 2026-10-04 against v0.10.9
(`META_VERSION` 21). It answers the owner's requests of 16:53, 16:57 and 17:16
(Limit Break), and every number in it is a starting point to tune in playtests,
not a decision.

Rules that apply to everything below (from `CLAUDE.md`, the handoff doc and the
owner's standing instructions):

- **Additive and optional.** Nothing existing is replaced or made retroactive.
  A new system is a new option, and an existing save plays exactly as before.
- **Not a lot on screen.** The owner already said the Forge round was too much on
  screen. Every new panel, readout and effect below is collapsed or compact by
  default, has an on/off setting, and respects reduced motion.
- **Data-driven.** New content is records under `data/`, not edits to the
  simulation loop. Where the engine must change, this plan names the one hook.
- **No penalty for losing a fight** (matches travel encounters). Progress is kept.
- Never use the banned word (see `CLAUDE.md`) in copy, ids or docs.
- Every release bumps `CHANGELOG`; `pnpm typecheck` and `pnpm test` stay green.

---

## 1. What was asked, and where each piece goes

| Ask | Plan section |
| :--- | :--- |
| More RPG aspects for leveling LokPets | 3 Pet growth |
| Expand the starting LokPet and companion so they stand out; always with you | 4 The companion |
| Expand evolutions for LokPets | 5 Evolutions |
| Companion nickname; name pets as you level or grow a relationship; unlock 1 to 5 nicknames | 6 Bond and names |
| LokPets with you in the hideout walking view, with special events | 7 Hideout presence and events |
| Level-up systems, earnables and loops that are fun to watch | 9 Level-up spectacle and loops |
| Expand operator levels; operators gain LokPet-exclusive stats and levels | 8 Operator levels and Handler track |
| DIGI-Tower: random, planned and faction enemies, Digi Masters, earnables; practice and pet leveling | 10 DIGI-Tower |
| Achievements and expansion | 11 Achievements |
| Limit Break for pets (max trust and max level, with a cost, leveling forever, extra benefits) | 8A Limit Break and the long ladder |
| More normal names for base levels; after the Limit Break, levels to 1000 with crazier names and badges, continuing forever | 8A Limit Break and the long ladder |
| Anything else recommended | 12 Recommended extras |

---

## 2. What exists today, and what to fix first

Facts verified in the code (paths under `artifacts/survivor-616/src/`):

- **Pets.** 78 variants (`game/data/lokPets.ts`), 4 rarities with fixed stat sheets,
  8 league tiers of arena battles (`game/data/lokPetBattles.ts`), 55 battle moves,
  a 10-element matrix, 5 trinkets, a kennel of up to 48 saved pets.
- **Pet level and XP.** Cap 50 (starters 99). XP to next level is
  `floor(50 * l^1.4)`. XP comes only from treats (+75), ranch kibble (+1 level) and
  arena battle wins. **Runs and travel fights give pets no XP**, and pet level
  barely matters in a run (it only scales the three starters' special abilities and
  the sprite size).
- **Evolution.** Stage is derived from level, never stored: starters at 33 and 66,
  everyone else at 15 and 30. About 29 variants have titled forms. It changes battle
  stat multiplier (x1.15 per stage), moves, and nothing visual except the title.
- **Starter and companion.** Three starters (`lil-llama`, `static-null`, `lil-buzbee`)
  chosen in an ambush encounter on first launch. A starter never spends stamina,
  is never benched, never expires in a run, and shows as the Hub's companion badge.
  So "always with you" already works.
- **Operator levels.** Player Level (display only) and per-operator Mastery. Mastery
  gives +0.01 power and +3 max HP per level, both capped at level 51; ranks
  Rookie, Veteran, Elite, Legend, Mythic are cosmetic. Both count in-run level-ups
  only, not XP.
- **Hideout.** `HubScreen.tsx` is a room menu. The walking operator is
  `HideoutPreview.tsx`: a canvas strip that walks the real rig back and forth. It
  has no LokPet in it. `HideoutVignette.tsx` is a two-rig gesture scene.
- **Achievements.** 39 pure functions over the save (`game/data/achievements.ts`),
  tiers only, manual claim, no completion toast, only two LokPet achievements.
- **Tower precedent.** `endless-gauntlet` is an engine-only battle mode with an
  unused `floor` field. Endless dungeons (3 rooms and a boss per entry) and the
  Director squads are reusable patterns for planned encounters.

### Phase 0: fixes that the new RPG layer depends on

These are small, and the rest of the plan stands on them.

1. **Battle XP is lost between battles.** `recordLokPetBattleResult` saves `level`
   and win counts but not the `exp` remainder. Persist it.
2. **Evolution thresholds disagree.** Battles use 15/30 (33/66 for starters); the
   run sprite-size code hard-codes 33/66 for everyone. One function should answer
   "what stage is this pet" for every caller.
3. **Arena engine edge case.** Burn, shock and glitch end-of-turn damage can drop a
   pet to 0 HP without marking it fainted (noted in the fight-styles memory). The
   Tower leans on this engine for long climbs, so settle it first.
4. **Stale text.** The league blurb and comments say 5 tiers (there are 8);
   `docs/lokpets.md` still describes chest-only temporary pets.
5. **Run setup picks one pet** even for Collectors with more slots. Make it match
   the roster screen's multi-select.
6. **Pet XP sources are tiny next to the pet XP curve.** Reaching level 50 needs
   about 255,000 cumulative XP and level 99 about 1.3 million, but a battle pays 120
   to 250 and a treat 75. Today levels really come from ranch kibble (+1 level for
   cred). Before adding more XP sources, run a pacing pass (a small simulation test)
   and either raise the sources about 10x or flatten the curve, aiming for roughly:
   level 30 in two weeks of casual play, level 50 in two months, a companion at 99 in
   about six months. Limit Break (below) depends on this being right.

---

## 3. Pet growth: RPG depth without breaking balance

Principle (design rule 4 stays): **rarity and level never make a pet unbeatable.**
Growth makes a pet *more yours*, with a bounded power gain.

### 3.1 XP from everywhere

| Source | Pet XP | Notes |
| :--- | :--- | :--- |
| Arena battle win | existing (120 / 150 x tier / 250) | persisted correctly after Phase 0 |
| Finishing a run | about 40 + 1 per 25 kills + 60 per boss, split across pets that were out | starter gets 100% share, others 60% |
| Travel fights (quick, duo, arena) | 25 to 60 | win or lose, so a loss never feels wasted |
| DIGI-Tower floors | see section 10 | the main "practice" source |
| Treats | existing +75 | |
| Hideout care actions | small, once per day each | feeds the bond meter more than XP |

All of it shows in one **Growth Recap** after a run (section 9).

### 3.2 Pet level matters in runs, bounded

Today a level 40 pet and a level 5 pet fight the same in a run. Add a run scaling
factor on the pet's damage and HP of `1 + min(level, 50) x 0.009` (about +45% at 50;
starters keep scaling to 99 with diminishing returns, capped at +70%). Stat-sheet
bounds in `data/lokPets.ts` stay the base. This is applied where
`startingLokPets` is built (`RunScreen.tsx`), so the sim loop is untouched.

### 3.3 Five pet stats you can train

Pets get five trainable stats: **Vigor** (HP), **Fury** (damage), **Guard**
(defense), **Pace** (speed and cooldown), **Spirit** (special ability and ultimate
strength, and bond gain). Each level grants 1 training point (2 on an evolution
level). Points are spent in the Tower's **Training Bay** or the kennel. Each stat
has a soft cap of +10 per stat (+20 for starters) so a build is a choice, not a
solved spreadsheet. A **respec** costs Training Data (below), never real money or
anything irreversible.

### 3.4 New currencies (all earned in play, none bought)

| Currency | Used for | Where it comes from |
| :--- | :--- | :--- |
| Training Data | stat points beyond level grants, respecs | Tower floors, runs, achievements |
| Evolution Cores | unlocking branch evolutions (section 5) | Tower Masters, rare run drops |
| Tower Tokens | the Tower's earnables shop (cosmetics, props, titles) | Tower floors and first clears |

Existing currencies (cred, card credits, treats, elixirs, loot tokens) keep their
jobs.

### 3.5 Personality, from the creature trait model

`data/creatureTraits.ts` already exists and is not wired to anything. Each pet gets
a **personality** derived (not stored) from its id: its top 2 or 3 defining axes
and one quirk. Personality never changes stats. It changes **how the pet acts in
the hideout, what it says, and a small battle flavor line** ("Skittish: flinches
before the first hit"). It is additive and works for every existing pet, because
it is computed from the pet's id.

---

## 4. The companion: make the starter feel like a partner

The starter is already always with you. To make it stand out from every other pet:

1. **A distinct look in play.** A subtle companion ring and nameplate in the run HUD
   and the Hub, so you can always find it among 4 other pets. (Setting: on by default
   for the companion only.)
2. **A name at the start.** The first-run encounter's "partner" phase gets an optional
   "Name your partner" field (skippable). That name is the companion's first name slot
   (section 6).
3. **Its own growth track.** Levels continue to 99 with ability tiers at 10, 25, 50,
   75 and 99 (today only 33 and 66 change anything).
4. **Three evolution branches per starter** (section 5), shaped by how you play.
5. **Bond Strike.** At bond rank 4 the companion gets one assist per run: a big,
   readable hit with a short cutscene-style freeze frame. Not available to others.
6. **Companion Trials.** Three special Tower floors per starter (unlocked by bond
   rank), with rewards only the companion can use: a unique cosmetic set and the
   third branch.
7. **It remembers.** Hideout lines and events that reference real events: your last
   run, a no-damage clear, a long break away, its evolution.
8. **Its own Dex page**, showing form, bond rank, names, branch and trial progress.

---

## 5. Evolutions: branching, visual, earned

### 5.1 The model

Add a data table `LOKPET_EVOLUTIONS` (new file `data/lokPetEvolutions.ts`). A record
is `{ from, to, stage, requires, visual }`:

- `requires` can be any mix of: level, bond rank, an Evolution Core, an element
  affinity (battles won with that element), a Tower floor reached, a time-of-day, or
  the companion flag.
- `visual` describes what changes: palette shift, an overlay of extra parts
  (horns, wings, halo, armor plates, flame mane) built the same way the Operator Forge
  features are (small `SpritePart` sets attached to existing rig keys), and a size
  scale. No new hand-drawn sprites.
- The chosen path is stored on the saved pet (`evolutionPath`); everything else stays
  derived, so old saves keep working. A pet with no recorded path follows the
  existing level-based stages exactly as today.

### 5.2 How many, and in what order

1. **Starters first:** 3 starters x 2 branches at stage 2, each with 1 stage 3 per
   branch, plus a hidden third branch unlocked by Companion Trials. About 18 forms.
2. **The 13 digi-themed legendaries**, one extra branch each.
3. **One generic branch per family** (animal, ghoul, bat, mote, blob, mechanical) for
   every non-legendary pet, so the whole 78-variant roster gets a second path without
   authoring 78 rigs: the family branch is a palette and overlay recipe.
4. **Mega stage** (a fourth, level 75+ and a bond requirement) for starters only, as a
   long-term goal.

### 5.3 Evolution as an event

An evolution plays the cinematic in section 9, shows what changed, and can be undone
once for free within the day (no one should lose a favorite form to a misclick).

---

## 6. Bond and names

### 6.1 Bond

Each pet has a **bond** meter. Ranks: **Stranger, Familiar, Friend, Partner,
Soulbound.** It grows from fighting together in runs, tower floors, treats, daily care
in the hideout, and hideout events, with a daily cap so it rewards regular play and
cannot be ground out in an hour. It never decreases. A pet you leave in the kennel
loses nothing.

### 6.2 Five names per pet

The ask was to unlock 1 to 5 nicknames. The design I recommend (confirm below):
**every pet has five name slots, each unlocked by a bond rank**, and each name has a
place it shows up, so naming is a reward with a visible payoff:

| Slot | Unlocks at | Where it shows |
| :--- | :--- | :--- |
| 1. Call name | Familiar (companion: immediately) | Hub, kennel, run HUD, summaries. This replaces the current free rename, so nothing is lost: existing custom names become slot 1. |
| 2. Battle name | Friend | Arena and Tower callouts and the battle log |
| 3. What it calls you | Friend | Hideout lines and event text |
| 4. Epithet (picked from a list, plus a custom option) | Partner | Nameplate and dex page: "Maple, the Unbothered" |
| 5. True name | Soulbound | Revealed at the pet's final evolution and on its card |

Rules: length-limited and stripped of control characters; chosen by the player, so it
is theirs. Names stay on the device; the Universe Exchange export keeps stripping a pet
to flavor only (`lok-universe-exchange` note), so nicknames never leave unless a
future feature asks.

---

## 7. Hideout presence and special events

The hideout's walking operator (`HideoutPreview`) gets the player's pets. The
companion is always there; other selected pets can join.

### 7.1 Presence

- **Follow behavior** with a lag and a personal space (so a big pet does not overlap
  the operator), drawn on the same canvas with the same `drawRig` path. No new rig per
  frame; pet rigs are cached by object identity as everywhere else.
- **Idle behaviors** chosen from the pet's personality: sit, sniff, nap (after about
  60 s of no input), wander, mirror the operator's steps, look at the weather.
- Reads the existing hideout scenes (rain, night) so a pet reacts to weather and time.
- Settings: **Pets in hideout** (on / companion only / off). Reduced motion shows a
  still pose. A "potato mode" fallback keeps the strip cheap.

### 7.2 Special events (data-driven)

A record `HideoutEventDef` has: id, conditions (bond rank, time of day, scene weather,
operator, pet family or element or personality axis), a short script (walk, anim,
emote, line), cooldown or once-only, and a reward (bond, small XP, a cosmetic, a
discovery). Starting list of about 14:

| Event | Trigger idea |
| :--- | :--- |
| Morning stretch | first visit of the day: the pet copies the operator |
| Rain day | rain scene: puddle splash, or hides under the operator |
| 3:16 visitor | the existing easter-egg hour: something odd approaches |
| Gift | after a run with a boss kill: the pet brings back a find (small reward) |
| Sleepover | long idle: pet curls up beside the operator |
| Dance | the player's own track playing (reuses music reactivity) |
| Practice cameo | the pet spars with a dummy; small XP |
| Rescued ally crossover | a crew ally interacts with the pet |
| Evolution eve | the pet glows the day before it can evolve |
| Anniversary | adoption date, with a cosmetic |
| Lost and found | a visiting creature (seeded from the creature model) you can befriend |
| Scare | high-dread personalities startle at the wrong moments |
| Companion callback | references your last run |
| Bond ceremony | a short scene when a bond rank is reached |

Events are shown as a small corner prompt, never a modal, and a **Hideout events**
setting turns them down or off.

---

## 8. Operator levels and the Handler track

### 8.1 Expand Mastery

- **A fuller, more ordinary rank ladder for levels 1 to 99** (details in 8A). Today there
  are only five titles over 35 levels and nothing after Mythic. The five existing
  titles stay exactly where they are; ordinary titles are added between and after them.
- **Milestone perks every 5 levels:** pick 1 of 2 from a perk list. To avoid authoring
  69 operators x N perks, perks come from a shared pool filtered by the operator's
  crew or kit type, plus one **signature perk** for authored operators over time.
- **Stat caps stay generous, not infinite:** keep today's caps at level 51 and add a
  second softer range (diminishing, capped about 2x today's total) to level 120.
- **Player Level gets rewards:** a small milestone reward every 5 levels (today it
  grants nothing).

### 8.2 The Handler track (LokPet-exclusive operator stats)

A per-operator **Handler level** that only affects LokPets, so it never competes with
the operator's own stats. XP comes from pet kills in runs, Tower floors with that
operator, and bond gains. Stats:

| Handler stat | Effect |
| :--- | :--- |
| Pack Power | pet damage % |
| Pack Tempo | pet attack speed % |
| Pack Guard | pet HP, and a chance to revive once per run |
| Rapport | faster bond and a larger XP share to pets |
| Pack Focus | shorter special-ability cooldowns |

At Handler levels 10, 25 and 50 the operator picks a **specialty** (Tamer: more
offense, Tactician: more cooldown and support, Bond Keeper: more growth). Caps are
bounded (about +40% on the main stats at the top). Collector operators' existing
team-slot bonuses are unchanged and unrelated to this track.

The one engine hook: count each pet's kills and damage during a run (a small field on
the in-run pet), so the run result can report them. Everything else is data and save.

---

## 8A. Limit Break and the long ladder

The owner wants levels that never really end: operators and pets that reach the cap can
**Limit Break** and keep leveling, with crazier names and special badges, up to 1000,
and then continue forever until more is authored.

### 8A.1 Base ladder: ordinary names for levels 1 to 99 (operators)

Today the only titles are Rookie (1), Veteran (5), Elite (10), Legend (20) and Mythic
(35), then nothing. Those five stay exactly where they are (nothing replaced). Ordinary
titles fill the gaps and run to 99:

| Level | Title | Level | Title |
| :--- | :--- | :--- | :--- |
| 1 | Rookie (existing) | 42 | Champion |
| 3 | Trainee | 50 | Master |
| 5 | Veteran (existing) | 58 | Grandmaster |
| 8 | Regular | 66 | Marshal |
| 10 | Elite (existing) | 75 | High Marshal |
| 14 | Specialist | 85 | Sovereign |
| 17 | Expert | 95 | Apex |
| 20 | Legend (existing) | 99 | Peak (Limit Break ready) |
| 26 | Captain | | |
| 30 | Commander | | |
| 35 | Mythic (existing) | | |

The title shows on the roster tile, the Archive and the run summary, and a rank-up
shows the existing notification. Pets keep their evolution titles and get a smaller
ladder of their own (8A.5).

### 8A.2 The Limit Break (the gate)

**Operators:** Mastery level 99. **Pets:** the pet's level cap (50, or 99 for a
starter) and a **Soulbound** bond. Each operator and each pet breaks the limit
separately, as a short ceremony the owner can skip.

| Cost (one time, per operator or pet) | Amount (to tune) |
| :--- | :--- |
| Cred | 250,000 for an operator, 150,000 for a pet |
| Limit Cores | 3 (a new currency from Tower Masters, the Grandmaster and end-game goals) |
| Pets only | 10 treats and an Evolution Core |

Level-ups an operator earns after 99 and before breaking are **banked**, not wasted,
and apply the moment it breaks. Nothing is lost by waiting. A pet that is not limit
broken stays exactly as today.

### 8A.3 Past 99: levels 100 to 1000, then forever

- **The curve is gentle, not the old one.** The old mastery curve would need about 7
  million in-run level-ups to reach 1000, which no one can do. After the break an
  operator needs `60 + 0.5 x (level - 99)` level-ups per level: about 14,700 total to
  reach 250, 64,000 to reach 500 and 257,000 to reach 1000. At about 35 level-ups a run
  that is about 420 runs to 250, so 250 is a few months of regular play, 500 about a
  year, and 1000 a long-term aspiration. A pacing simulation sets the real numbers.
- **Pets** use a flattened XP curve after the break (about 8,000 XP per level rising
  slowly), fed by the rebalanced XP sources, the Tower and Limit-only activities.
- **Forever:** at 1000 the level keeps counting. Names and badges past 1000 follow a
  generated scheme (below) until more are authored, so nobody ever hits a wall.
- **Display:** the level badge supports four digits. Pets show their cap plus Limit
  Level, for example "Lv 99 and LB 120", and the total counts toward ranks.

### 8A.4 Names and badges: a name every 25 levels

A named title every 25 levels, so each one is a goal. A **badge** with every title
(the shape steps up every 100 levels), and a **milestone badge** with unique art every
100 levels. These 36 names are drafts:

| Level | Name | Level | Name | Level | Name |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 100 | Limit Breaker | 400 | Fourfold | 700 | Seventh Heaven |
| 125 | Overdrive | 425 | Voidrunner | 725 | Prismborn |
| 150 | Redline | 450 | Halo Burn | 750 | Three Quarters Divine |
| 175 | Surge Walker | 475 | Apex Predator | 775 | Nightlamp |
| 200 | Double Century | 500 | Halfway to Forever | 800 | Octave |
| 225 | Stormcaller | 525 | Starforged | 825 | Skybreaker |
| 250 | Quarter Thousand | 550 | Gridwalker | 850 | Hollowfire |
| 275 | Riverbreaker | 575 | Tidebinder | 875 | Zero Hour |
| 300 | Triple Crown | 600 | Sixfold Crown | 900 | Nova |
| 325 | Firecoil | 625 | Cometbearer | 925 | Eventide |
| 350 | Neon Sovereign | 650 | Thunderhead | 950 | Last Light |
| 375 | Skyward | 675 | Deepcache | 975 | Edge of Forever |
| | | | | 1000 | The Thousand |

Badges are drawn procedurally (rings, wings, crowns, flames, halos in the operator's
palette), not bitmaps, like everything else. Each shows on the roster tile, nameplate,
Archive and summary, and the 1000 badge has its own animated frame.

**Past 1000 (until more is authored):** the title stays "The Thousand" with a star
added every 100 levels, and the badge changes color every 1000 levels. It is data in
`data/limitLadder.ts`, so adding real names later is adding rows, not changing code.

### 8A.5 Pet Limit Break benefits

Gains are bounded, so a limit-broken pet is better, never unbeatable (design rule 4):

- **Power:** the run scaling from 3.2 gains up to a further +30% that approaches its
  cap smoothly (`0.30 x (1 - e^(-LB/300))`), so early Limit levels matter most.
- **Training cap:** each trainable stat's cap rises by 1 per 10 Limit Levels.
- **Limit skills:** at Limit Level 10, 25, 50, 100, 250, 500 and 1000, pick one of two
  skills (a stronger special, a second Bond Strike charge, a revive, a trail effect).
- **Mega stage:** for non-starters, Limit Break is what unlocks a Mega form (starters
  get it at their own milestone).
- **Bond rewards:** a Limit Break ceremony hideout event, the true name glowing, and a
  pet nameplate frame.
- **Pet ladder:** Limit Ranks for pets, every 50 levels, with their own shorter names
  and badges (for example Unbound, Overcharged, Ascendant, Radiant, Eternal), then the
  same generated scheme past 1000.

### 8A.6 Operator Limit Break benefits

- Mastery stat caps rise on a soft curve (an extra +0.5 power and +100 max HP over
  1000 levels, approaching the cap smoothly), so a level 1000 operator is stronger but
  not a different game.
- A **Limit perk** at 100, 250, 500 and 1000 (the same pick-one-of-two system as the
  milestone perks), and a higher Handler level cap.
- An aura and nameplate cosmetic tied to the current Limit title.
- Achievements and a Limit Break entry in the Archive.

### 8A.7 Risks

- Limit Break is a long grind by design, so the pacing simulation and an easy way to
  see "how far to the next name" (a progress bar on the roster tile) matter more than
  any single number.
- Saves: pet level caps and the mastery counter must stay clamped for anyone not
  limit-broken, and a v21 save must load unchanged (a migration test checks both).

---

## 9. Level-up spectacle and watchable loops

The owner wants loops that are fun to watch. All of this is presentation, optional
and skippable.

- **Level-up Roulette** (a new level-up presentation next to Focus, Compact and Random
  reel in Settings): a reel spins across the three choices and settles with a short
  ease and a pop. Today the "reel" is the loot-box reel only; there is no level-up
  reel. Existing options stay and stay the default.
- **Evolution cinematic**, about 4 seconds, skippable, shorter under reduced motion:
  charge (body tint pulse and particles), flash, morph (old and new rig cross-fade
  with a scale pop), reveal (name plate, new title, stat deltas).
- **Growth Recap** after a run: animated bars for operator XP, Player Level, Mastery,
  Handler, and each pet's XP with bond hearts. A compact form is the default.
- **Tower Watch mode**: auto-battle with 1x, 2x and 4x speed and a skip, for people who
  want to watch a climb. Manual stays the default.
- **Highlights**: evolution and Master wins feed the existing highlight clip reel.
- **Earnables:** pet collars, hats, trails, auras and nameplate frames; hideout props
  (bed, bowl, toy) that appear in the walking strip; operator titles; Tower banners;
  alternate palettes for evolved forms. Today cosmetics are bought and no reward path
  grants one, so this needs one generic **grant cosmetic** action and an owned list
  per slot, following the existing `owned*Ids` pattern.

---

## 10. DIGI-Tower

### 10.1 The shape

A tower of **100 floors in 10 sectors**, climbed with a team of your pets (the
companion always takes the first slot). It is the place to level pets, try builds
and practice, with no penalty for losing. After floor 100 it continues as a seeded
**Endless Spire**, which is what the infinite-roster work is for.

Recommended v1 is **turn-based, using the arena battle engine** (the one used by
Arena travel fights, which has the depth for long fights), because the pet systems
above all live there and it is the lowest-risk path to something that ships. The
operator joins as an assist exactly like the Arena style does today. **Operator
floors** (short survivor-style rooms) and **Duo floors** (operator and pet fighting
together, which the owner wanted earlier) are a later phase, built on the dungeon
room pattern and the Duo fight.

### 10.2 Floor types

| Type | What it is |
| :--- | :--- |
| Random | Generated from a seed and the floor number, drawn from the sector's faction roster, so it is different each climb. |
| Planned | Hand-authored encounters with a trainer, a short line of story and a set team. |
| Faction | A themed floor where the whole team belongs to one faction (Data Goblins, Glitch Breach, Digitized Damned and so on), with that faction's flavor and an element lean. |
| Digi Master | The sector's final floor: a named opponent with a full team, a signature field rule, and a three-phase fight. Ten in all, plus a Grandmaster. |
| Rest | Heal, a small shop, and a free **Training Bay** visit. |
| Vault (earnable) | Choose 1 of 3 earnables or Cores. Appears from floor 5. |
| Mirror | Fight a copy of your own team. A practice floor with a gentle reward. |
| Mystery | A short choice event that can raise bond or give a small reward. |

### 10.3 Sectors (working titles)

| Sector | Theme and factions | Opponent level (approx.) | Digi Master (working name) |
| :--- | :--- | :--- | :--- |
| 1 Boot Sector | Data Goblins, dust mites | 3 to 9 | Master Nib |
| 2 Packet Alley | Glitch Breach | 9 to 16 | Master Dropframe |
| 3 Canopy Stack | Arbor Collective | 16 to 23 | Master Rootkit |
| 4 Neon Overflow | Cabinet Rot, High Roller | 23 to 30 | Master Cabinet |
| 5 Lev Spire | Lev Syndicate | 30 to 37 | Master Overclock |
| 6 Hollow Cache | Firefly Wranglers, Digitized Damned | 37 to 44 | Master Hollow |
| 7 Reel Vault | Reel Syndicate and Director squads | 44 to 51 | Master Reel |
| 8 Null Basement | Null Sector | 51 to 58 | Master Null |
| 9 Prism Core | Prism Choir, Lockstep | 58 to 66 | Master Prism |
| 10 Apex Terminal | all factions remixed (needs the end game) | 66 to 80 | Grandmaster Apex |

These tie into the existing faction registry (`data/factions.ts`). Faction rosters
are survivor-mode enemies, so the Tower needs a small adapter that turns an enemy
into a battle opponent (family to silhouette, role to a stat sheet). Names above are
placeholders to approve or replace.

### 10.4 Rules and rewards

- **Climbing:** HP and status carry between floors. You heal at Rest floors. If your
  whole team faints, the climb ends, you keep the XP and rewards earned, and you
  restart from the last **checkpoint** (every 5 floors). No penalty beyond that.
- **Practice mode:** replay any cleared floor or the Training Bay at reduced rewards
  (about 25%) with no risk, to test a build.
- **Rewards:** pet XP (scaled by level gap, with diminishing returns on repeats),
  Training Data, Bond, Tower Tokens, a first-clear bonus once per floor, and the
  occasional Evolution Core. Masters pay Cores and a unique earnable.
- **Daily floor:** one seeded floor per day with a bonus, the same for every player.
  No server needed.
- **Unlock:** opens after the starter encounter and a first win; later sectors need
  league badges; sector 10 needs the end game.
- **Earnables at a defined point:** the Tower Token shop opens at floor 10, with the
  first Vault at floor 5.

### 10.5 Where it lives and how it is built

- **Entry:** a new **Tower** tab in the LokPet battle screen (next to League, Sparring
  and Kennel). Lowest risk. A separate Hub room can come later, but a Hub room needs a
  resident ally and activities, so it is not v1.
- **Data:** `data/digiTower.ts` (sectors, planned floors, Masters, rewards) and
  `engine/tower.ts` (a pure function from seed and floor to a floor definition, which
  reuses `createBattle` and `generateOpponentPet`).
- **Random opponents** can draw names and themes from the creature trait generator,
  with stats still clamped to the existing stat sheets.
- **Engine addition:** a small optional **field rule** on a battle (for example "fire
  moves are stronger this fight") for Masters. Additive; battles without one behave as
  today.
- **Save:** `towerProgress` (best floor, checkpoint, Masters defeated, the climb in
  progress so a reload does not lose it), plus the three currencies.

---

## 11. Achievements

Today: 39 achievements, tiers only, manual claim, no completion toast. Plan:

- Add a **category** field (Run, Collection, Pets, Bond, Tower, Handler, Hideout) so a
  list of 100 or more stays navigable, and an optional **hidden** flag for easter eggs.
- Add about 60 new achievements: pet levels 10/30/50/99; first evolution; every branch
  of a starter; each bond rank; unlocking all five names; Tower floors 10/25/50/100;
  each Digi Master; each faction floor; flawless floors; a fast climb; Handler
  milestones; operator rank milestones; hideout events seen.
- Add a **completion toast** by comparing before and after in the reducer (the same
  approach as the end-game announcements), so completion stays derived and nothing new
  is stored (the existing "no stored booleans" rule).
- Extend reward kinds with Training Data, Evolution Cores, Tower Tokens and a grant of
  a cosmetic (needs the grant-cosmetic action from section 9).

---

## 12. Recommended extras

- **Daily Tower seed and a personal best card** you can share as an image, no server.
- **Care loop:** optional 10-second hideout actions (feed, play, groom) once per day
  each. Small, charming, bond-focused, and skippable.
- **Pet moods** shown as one icon, from the personality in section 3.5.
- **Tower rival:** a named trainer who reappears with a stronger team every sector.
- **Settings group "Pets and Tower":** one place to turn each new thing on or off,
  so the screen stays as quiet as the owner wants.
- **Real-device pass** on phone and tablet for the hideout strip, the cinematic and
  Tower Watch mode before each release.

---

## 13. Save changes and tests

- **Saved pet** gains optional fields: bond, names (slots 2 to 5), `evolutionPath`,
  trained stat points, hideout events seen. All optional, so old saves load as before.
- **Limit Break** adds: a limit-broken flag per operator and per pet, banked level-ups
  for operators who pass 99 before breaking, Limit Cores as a currency, and pet level
  caps that lift only for a limit-broken pet (so every existing save still clamps at
  50 and 99 exactly as today).
- **Meta** gains: tower progress and its three currencies, Handler data per operator,
  owned pet cosmetics. This is a `META_VERSION` bump (22) with `normalizeMeta` coverage
  and a migration test that loads a v21 save and checks nothing changed.
- **Tests:** unit tests for XP persistence, bond ranks and name unlocks, evolution
  requirements, floor generation determinism (same seed, same floor), Master data
  validity (ids exist, banned word absent, levels in range), reward bounds, achievement
  rules, and the hideout event conditions. Browser tests for the Tower tab, naming,
  and the hideout pet. The existing 471 unit and 43 browser tests keep passing.

---

## 14. Phases (each is a releasable version and its own PR)

| Version | Name | What ships | Size |
| :--- | :--- | :--- | :--- |
| 0.11.0 | Bond and Growth | Phase 0 fixes; pet XP from runs and travel; bond ranks; the five name slots and the companion naming prompt; Growth Recap; achievement categories and completion toast | Medium |
| 0.11.1 | Hideout Companions | Pets in the walking strip, idle behaviors, personality, first 8 events, settings | Medium |
| 0.11.2 | Evolutions | `LOKPET_EVOLUTIONS`, starter branches, evolution cinematic, undo | Medium to large |
| 0.11.3 | Handlers and Ranks | The 1 to 99 rank ladder with ordinary names; milestone perks; Handler track and specialties; run pet scaling | Medium |
| 0.11.4 | DIGI-Tower I | Tower tab, floors 1 to 30, random, planned and faction floors, 3 Masters, practice, Training Data and stat training | Large |
| 0.11.5 | Limit Break | Limit Break for operators and pets, Limit Cores, the 100 to 1000 ladder and beyond, names, badges, limit skills (needs the first Masters for Cores) | Large |
| 0.11.6 | DIGI-Tower II | Sectors 4 to 10, Tower Tokens shop and earnables, Watch mode, Companion Trials | Large |
| 0.11.7 | Spectacle | Level-up Roulette, grant-cosmetic system, pet cosmetics, Limit Break cinematic, remaining hideout events | Medium |
| 0.11.8 | Spire and Achievements II | Endless Spire, daily floor, the remaining achievements (including the Limit Break ones), Duo floors | Medium to large |

Each phase is testable on its own and nothing in a later phase is needed to enjoy an
earlier one. 0.11.0 comes first because every other phase reads bond, XP and names.

---

## 15. Decisions for the owner (defaults used if there is no answer)

1. **Nicknames.** Default: five name slots per pet, unlocked by bond rank (section 6).
   The other reading was "you must unlock the ability to nickname 1 to 5 pets in
   total." Say so if that is what you meant and I will switch it.
2. **Tower style.** Default: turn-based pet climb first, then Operator and Duo floors.
3. **Pet power in runs.** Default: about +45% at level 50, starters up to +70%.
4. **Tower unlock.** Default: after the starter and a first win, with later sectors
   gated by league badges and sector 10 by the end game.
5. **Master names and the sector list** are placeholders.
6. **Limit Break.** Default: the same break for operators and pets (cap, max rank, a
   one-time cost), levels to 1000, then endless; the 1 to 99 names, 36 Limit names and
   badges in 8A are drafts to approve or rewrite.
6. **Which animals first** and **Duo versus Arena as the default fight** are still
   open from before and still affect the LokPet roster work.
