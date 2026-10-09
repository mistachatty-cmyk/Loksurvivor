# Hideout rewards, LokShop, morale and LokPet expansion: raw design notes

Status (updated 2026-10-09): **partly built.** The original notes came from the owner's brain-dump on
2026-10-08; the table below tracks what has shipped and what is still open. Open questions are
flagged `Q:`. Everything lands as **data in charts/tables plus small systems with clean code**
(the data-driven rule in `CLAUDE.md`: new content is a record, not an engine edit).

## Build status

| Item | Status | Version | Where |
| --- | --- | --- | --- |
| Relay Crate "does nothing" bug | Fixed: a prop no longer burns its daily claim when the daily caps pay nothing | 0.21.5 | `state/metaStore.tsx`, `ui/HubScreen.tsx` |
| Crew morale (wins/losses, negative, +0.25 stack after endgame, reset on loss) | Built, crew-wide | 0.21.6 | `data/morale.ts` |
| Win streak counter (feeds the future leaderboard) | Built | 0.21.8 | `data/morale.ts`, Resources panel |
| Intro easter eggs incl. Perfect L13gend salute | Built | 0.21.7 | `data/introEggs.ts` |
| Sky Spyglass: eclipse, glyphs, eclipse + glyphs | Built; boost is started by looking, 1 hour, once per 2-hour window | 0.21.9 | `data/skyEvents.ts` |
| Lucky Chest event (tiered loot, cards, cosmetics) | Built; chest-only cards NOT done (uses existing cards by rarity); no pop-up/float-out yet | 0.22.0 | `data/chestLoot.ts`, `engine/chestOpen.ts` |
| Seizure and photosensitivity warning | Built | 0.22.1 | `ui/PhotosensitivityNotice.tsx` |
| LokShop + LokServer shell, knowledge doc | Built; shelf is preview only | 0.22.2 | `data/lokServer.ts`, `docs/lokserver-knowledge.md` |
| The Ball (fetch, throw, race, winner routine) | Built; gated by `ownsBall`, no purchase path yet | 0.22.3 | `data/hideoutBall.ts`, `engine/hideoutBall.ts` |
| Light Spurs | Not started | | |
| Chest Pass (3-round LokToken consumable) + leaderboard stash | Not started; blocked on the LokToken catalog decision below | | |
| Event rework (story + boost + negation) | Not started | | |
| Ambient events, emotions, llamas, Digi mite, bell | Not started | | |
| Looks-first UI pass | Not started | | |
| Pet rider (5 jumps, knock-off, enrage) | Not started | | |
| Crew expeditions | Not started | | |
| Leaderboard on gsix | Not started (streak data exists) | | |

### Blocker: LokToken purchases
Real LokToken spending goes through the shared account economy (`lok_catalog` on the shared server).
The Ball, Chest Pass and Rider Saddle each need a catalog entry (generate the SQL with
`scripts/export-lok-registry.ts`; someone must apply it to the shared project). The existing
`spend()` treats a purchase as buy-once, so rebuyable consumables (Chest Pass) need either a
repeatable item type on the server or a per-use token count. Until decided, `ownsBall` is the
local gate and the LokShop shelf shows these as Coming soon.

### Not yet verified by eye
The Ball was driven in headless Chromium (state read out, a few screenshots); the title screen
pops, Resources tiles, chest and spyglass props have not been looked at in a browser.

Rules that apply to all of it:
- Every hideout payout goes through `engine/hideoutRewards.ts` (daily caps, rare limits) -
  see `.agents/memory/hideout-interactables.md`. Idle events stay a chip, never a pop-up.
- Follow the `CLAUDE.md` naming rule (the prohibited word listed there). Use beacon / pulse / relay / static / frequency.
- Player-facing text goes in `src/locales/en.json`; invented nouns go in the `glossary` of `l10n.config.json`.
- Every update bumps `CHANGELOG` and re-exports `public/lok-updates.json`.
- Lore changes need the `export-public-lore.ts` sync; store changes need the `export-lok-registry.ts` sync.

---

## 1. Reward audit (walking operator hideout)

Goal: more **meaningful** rewards, especially for crew and interactable objects.

Current problems called out:
- **Events are meaningless**: when something happens it is the same rewards every time. Each event
  needs a *story explanation* plus a **boost and a negation** (a trade-off), not a flat payout.
- **Relay crate**: its button does nothing. (Bug - fix or replace.)
- **Chest rewards are too thin**: must be expanded (see section 3).

Deliverable for planning: one **Reward table** (id, source, tier, payout kind, cap, story line,
boost, negation) so every interactable reads from the same chart instead of ad hoc numbers.

## 2. Sky events and spyglass (new interactable)

### 2a. Spyglass
A prop the operator can **look through**. It reveals sky events (below) and scouting leads.

### 2b. Eclipse
- "Show the Eclipse": **+5% experience for an hour, refresh every 2 hours** (owner's wording: "+5
  experience for an hou - refresh every 2").
- Q: confirm 5% and whether "hour" is real time or run-time. Prefer run-count or real time with the
  existing daily-cap machinery.

### 2c. Glyphs in the sky
- Glyphs appear in the sky and **charge all stats +10%**.
- **Eclipse + glyphs together (the mix)**: 10% glyph bonus + 5% experience from the eclipse, and
  then **every stat gets a 15% bonus** (owner: "that makes sense" - treat 15% as the combined stat
  total, XP stays +5%).
- Standalone glyph sky (no eclipse): just the 10% all-stat boost.
- Implementation shape: a `SKY_EVENTS` chart (id, weight, duration, refresh, boosts, requires) so
  new sky events are rows. Combination rules live in the chart, not in code.

### 2d. Light Spurs
- Light Spurs appear in the sky **over locations with many Digi enemies**, moving abnormally.
- Seeing one through the spyglass **reveals a new level location and unlocks it**.
- Data: a `SPUR_LEADS` chart mapping spur -> `areaId` to unlock. Ties into section 8 (scouting).

## 3. Special chest event (pops up)

"Actually make that a special chest event that pops up." The chest becomes a rare event with a
much bigger loot table:
- Resources (as filler), skins, **cards** by rarity: common, uncommon, rare, ultra rare, etc.
- **Chest-exclusive cards**: some cards can *only* be found here.
- Special items.
- Data: a `CHEST_LOOT` chart (rarity tier weights, filler resource table, exclusive card list,
  special items). Reuse the card rarity ladder in `data/cards.ts`; do not invent a second ladder.

### 3a. Leaderboard chest (stash and claim)
- The chest holds **any extra loot from a run** so it can all be opened/claimed there or added to stats.
- Requires buying a **consumable that lasts 3 rounds**, paid **exclusively in LokTokens**.
- **Keep what the chest does now.** The new behaviour is a **pop-up option above the chest, as if
  floating out of it**; the player chooses it as an option.
- Q: what happens to unclaimed extra loot when the consumable lapses (expire, or bank for next use)?

## 4. Crew morale system

- Crew morale goes **up/down based on winning or losing runs**; it can go **negative**.
- A loss before morale balances out pushes it negative.
- After **endgame is unlocked**, morale can **stack**: each run in a row adds **+0.25 to any boost the
  crew offer**, stacking **infinitely**.
- **A lost run resets the stack.**
- Q: is morale per crew member or crew-wide? (Notes read crew-wide; per-member flavour could layer on.)
- Data: a `MORALE_RULES` chart (win delta, loss delta, floor, endgame stack step 0.25, reset rule).
  The run-streak counter doubles as the leaderboard stat below. Persist in `state/metaStore.tsx`;
  new fields must be concrete numbers (see `effectiveStats()` NaN warning in `CLAUDE.md`).

### 4a. Leaderboard plan (especially gsix)
- Show people's **runs in a row** and their **boost**; **reset monthly**.
- gsix.online side lives in `Gsixhub`/`lib/lok-universe`; the SDK is vendored here (never edit it in
  this repo - change `Lok-EcoSystsem/universe-sdk`). Plan the score payload + monthly reset window first.

## 5. LokShop and LokServer

- **LokShop** is a placeholder name, run by **LokServer**: a **digital host** in the new design that is
  actually an **AI-looking being**. It sells LokToken buyables.
- Personality (for now): friendly, cheery, focused, selling, **owl energy sometimes**.
- Has a **text generator** (can reuse the seeded expander from `docs/CREW_CHATTER.md` / Rant approach
  for offline lines; live AI generation is a later option).
- **Knows lore**: things past the eclipse, other universes, and the other games in the ecosystem,
  including things inside them that we can build.
- Action item: start a **LokServer knowledge doc in markdown** (lore, other games, buildable things,
  charts/plans) that grows over time and feeds both the text generator and planning.
  Suggested home: `docs/lokserver-knowledge.md`.
- Shop stock called out so far: the **ball** (section 7). Consumables for the chest (section 3a).
  Sells only LokToken items; palettes are already LokToken-only (`LOKTOKEN_ONLY_KINDS`).

## 6. Ambient random events and emotions

Random events that happen around the hideout:
- **Llamas run across the screen**, surprising characters: scaring them or making them happy.
- **Surprise characters** appear.
- Characters get **emotions with matching visuals**; add an **adore / adorable** expression.
- **Running man** can run past.
- A small **Digi mite** wanders in and can be **squashed with a little animation**.
- **Resources spawn randomly on the ground** to pick up (through the capped reward choke point).
- **The bell does something** (currently inert; define its effect, e.g. summons a visitor or calls the crew).
- Data: `AMBIENT_EVENTS` chart (id, weight, cast, reaction per character, emote, payout or none)
  and an `EMOTES` chart (id, visual, duration, trigger). Extend `data/ambient.ts`; do not special-case in the loop.

## 7. UI: Looks, LokPets nav, themes

- **Looks first**: build Looks before the rest of this UI work.
- Looks and LokPets get **nav that seamlessly slides between pages**.
- **Looks must actually affect the UI** so the player previews exactly what it will look like when
  they leave (live preview, not a thumbnail).
- **Themes go at the bottom** of the screen.
- **Theme palette slider is hard to work**; improve it.
- **Look Lab looks bad**; redesign it.

## 8. LokPet interactions

### 8a. Animation
- Much more **actual animation** when playing with / interacting with pets.

### 8b. The Ball (LokShop item)
- Bought in LokShop. **Spawns on the ground** (no storage system yet; revisit storage later).
- Flow: player **clicks the ball** -> the character **walks over and picks it up** -> a **directional
  throw** whose power/feel is **affected by the UI theme** -> **pets race for it** if interested.
- Interest: **most pets positive**. Some are **against it** unless boosted by relationship and after
  playing with them.
- Per-pet **speed stat** for race outcomes: **all LokPets get a speed stat** (reuse any existing stat
  before adding a new one).
- Retrieval sequence for the winner: **spit the ball out, then spin, then jump on your head, then
  jump off.**
- Data: `PET_BALL_INTEREST` chart (temperament -> base interest, relationship threshold to flip) plus
  throw tuning keyed by theme. See `pet-growth-and-bond.md` for temperaments and bond ranks.

### 8c. Head/back rider (planned, later)
- After **5 jumps onto your back**, that LokPet can **stay on** through the simulation and through
  **1 run**.
- If player health **drops below 25%**, it is **knocked off**: fall-off animation, gets up and is
  **left behind, mad**.
- Consequences: the player is **slightly faster permanently** (less weight), plus a **slightly higher
  boost for 5 seconds** that **wears off**.
- The angry pet **enrages**: **glowing eyes**, a special colour, **spitting flames or elements based on
  its own personal element**.
- Data: `RIDER_RULES` chart (jumps to unlock = 5, stay duration = 1 run, knock-off threshold = 25%,
  permanent speed bonus, 5s burst curve) and per-element enrage visuals.

## 9. Crew expansion (brainstorm)

- Add more to crew members.
- **Send crew out** to: **scout**, **gather resources**, **find survivors / survivor locations**.
- Discoverables: **LokPets, Survivors, Operators, enemy hideouts** - and **being the same location
  with special remixes noted**, with **bonuses**, or maybe a **guaranteed something special**.
- Light Spur sightings (section 2d) feed this as scouting leads.
- Brainstorm hooks to evaluate when planning:
  - Expedition chart: duration, party size, risk, yield table, morale effect (win/lose feeds section 4).
  - Crew skills mapped to expedition types (scout vs forage vs rescue).
  - Remix tags on revisited locations (e.g. a modifier row with a bonus or a guaranteed drop).
  - Crew banter tied to returns (use the Rant expander from `docs/CREW_CHATTER.md`).
- Build on `.agents/memory/crew-feature.md` (`RESCUE_ROUTE_BY_AREA`, hub rooms, `rollCrewActivities()`).

---

## Suggested planning order (proposal, owner to confirm)

1. Reward audit chart + fix relay crate + give events a story/boost/negation (unblocks everything else).
2. Looks-first UI pass (live preview, bottom themes, slider, Look Lab, slide nav).
3. Crew morale + streak counter (also feeds the leaderboard).
4. Sky events (spyglass, eclipse, glyphs, Light Spurs) and the special chest event.
5. LokShop/LokServer shell + knowledge doc, then ball, then the chest-stash consumable.
6. Ambient events/emotions, pet animation, speed stats, ball race.
7. Rider mechanic and crew expeditions (largest, depends on the above).

## Open questions collected

- Eclipse timer: real time or run-based? Exact numbers (5% XP, 10% glyph, 15% combined) confirmed?
- Morale: crew-wide or per member? Does it show a visible meter?
- Chest consumable: what happens to leftover loot after 3 rounds?
- Leaderboard: gsix-side schema and monthly reset ownership.
- Bell: intended effect?
- LokServer: offline seeded lines only, or live AI generation, and who pays for it?
