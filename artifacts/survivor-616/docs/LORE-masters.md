# The Masters: veterans, leaders and commanders of Sector 616

Status: **lore only.** Nothing here is wired to gameplay yet except as the story
behind the DIGI-Tower's Digi Masters (see `docs/lokpet-rpg-and-digi-tower-plan.md`).
It is saved now so later work, new characters and new areas have a shared ladder to
hang names on. The typed copy is `src/game/data/masterLore.ts`. Everything marked
"provisional" is a placeholder to approve, rename or replace; adding more is adding
rows.

Continuity: this sits inside the Sector 616 premise in `docs/LORE.md`. ARCHON-616
built the pocket dimension, the Directors hunt for soul sparks, and a resistance
(Lock Decks, Digital Russel) keeps people alive. The Masters are what the
**survivors** built in response: a ladder of earned authority, so someone always
knows who to follow, who to ask and who not to cross.

## The ladder

Six ranks, lowest to highest. Rank is earned by deeds, and it is recognized by other
survivors and, with grudging respect, by the factions.

| Rank | Who they are | Where you meet them |
| :--- | :--- | :--- |
| **Master** | A veteran who mastered one craft: a fighting style, a route, a trade, a pet-handling way. Not a commander, but people listen. The "epic vet." | Scattered everywhere: hideout rooms, back alleys, markets, the arena. Teachers, rivals and old hands. |
| **Sector Lead** | The leader of a single sector's survivors and outposts. Keeps the lights on, the routes open and the arguments short. | One per sector, in its hub or safehouse. The first face a new arrival meets. |
| **Sector Mage** | The sector's master of **Anima Resonance**, the soul-spark arts. Reads the Grid the way a sailor reads weather, and advises (and sometimes overrules) the Lead. | Near a sector's oldest relay or its deepest cache. Keepers of the odd rules. |
| **Sector Master** | The sector's martial commander. Runs the defense, the patrols and the fighting men and women. Where the Lead governs, the Sector Master decides who fights and when. | At a sector's front line, gate or arena. |
| **Master Divine** | A rare few who have pushed past what a survivor is supposed to be able to do. The ones people say have *broken the limit*. There are never many, and each is known by name across the city. | Almost never met by chance. Reached by deed, by invitation or by a challenge. |
| **Digi-Master** | The apex. A Digi-Master holds a whole sector of the DIGI-Tower and answers only to the Tower itself. Part champion, part warden, part legend. | The top floor of a Tower sector. Facing one is a rite of passage. |

Sector Lead and Sector Mage and Sector Master are three seats of one sector's
leadership: **the Lead governs, the Mage knows, the Master fights.** A sector with
all three filled is strong; one with a seat empty is a story.

## Relationships

- A **Master** can become a Sector Lead, Mage or Master by being chosen, never by
  seniority alone.
- A **Sector Master** and a **Sector Mage** often disagree, on purpose. The Lead sits
  between them.
- A **Master Divine** outranks every sector seat but holds no sector. They are
  neither commanders nor subjects, which is why they are feared and trusted equally.
- A **Digi-Master** is not a Master Divine. It is a post, not a person: the post can
  be won, lost and passed on. (A Master Divine can also be a Digi-Master. Some are.)
- The **Directors** (the Director, the Warden, the Promoter, the Cutting Room,
  Continuity) are not part of this ladder. They are ARCHON-616's agents, and the
  ladder exists because of them.

## Provisional named figures

Original, placeholder names. Faction ids match `src/game/data/factions.ts`.

### Digi-Masters (the DIGI-Tower sectors)

| Sector | Digi-Master | Faction |
| :--- | :--- | :--- |
| 1 Boot Sector | Master Nib | data-goblins |
| 2 Packet Alley | Master Dropframe | glitch-breach |
| 3 Canopy Stack | Master Rootkit | arbor-collective |
| 4 Neon Overflow | Master Cabinet | cabinet-rot |
| 5 Lev Spire | Master Overclock | lev-syndicate |
| 6 Hollow Cache | Master Hollow | firefly-wranglers |
| 7 Reel Vault | Master Reel | reel-syndicate |
| 8 Null Basement | Master Null | null-sector |
| 9 Prism Core | Master Prism | prism-choir |
| 10 Apex Terminal | Grandmaster Apex | (all) |

### Elsewhere in the world

| Rank | Name | Where | Note |
| :--- | :--- | :--- | :--- |
| Master | Old Tinsel | the hideout main floor | A retired cypher champion who still corrects everyone's footwork. |
| Master | Quill | the back alley | The best pet-handler nobody has heard of. |
| Sector Lead | Lead Candlewick | Monroe Strip | Keeps a candle in a streetlight that never quite commits. |
| Sector Lead | Lead Tollbooth | the back alley | Charges a small fee for everything and keeps meticulous books. |
| Sector Mage | Mage Lattice | the relay under Monroe | Hears the Grid humming and has stopped finding it unusual. |
| Sector Mage | Mage Pennywhistle | the Firefly Hollows | Talks to the fireflies, who talk back. |
| Sector Master | Master Ironwood | the work zones | A foreman who learned to wear armor and never took it off. |
| Sector Master | Master Gantry | the Lev skyway | Commands the ground that watches the sky. |
| Master Divine | Divine Orpheus | unknown | Said to have left the city once and come back. |
| Master Divine | Divine Halcyon | unknown | Said to fight with the calm of someone who has already won. |

## Callings: leaders who are not about war

Rank says how much authority someone holds. **Calling** says what they lead. War and
survival are only two of nine. Any rank can hold any calling, and every calling has a
city version and a digi-realm version.

| Calling | In the city | In the digi realm |
| :--- | :--- | :--- |
| War | Commanders, champions, front-line veterans. | Packet-wardens and Tower champions. |
| Survival | Scouts, handlers, wayfinders. | Cache-runners and cable-guides. |
| Civic | Politicians, speakers, council-keepers. | Digi mayors and quorum-clerks, elected by checksum. |
| Spiritual | Chaplains and keepers of the evening hour. | Oracles and cursors people ask questions of in the dark. |
| Commerce | Brokers, tollkeepers, market-builders. | Cycle-traders and cache-brokers. |
| Invention | Tinkers and engineers. | Architects and patch-smiths who rewrite the Grid's rules. |
| Genius | Prodigies and savants. | Savants made of pure pattern. |
| Culture | Cypher champions, radio hosts, label heads. | Tape-spirits and jukebox keepers. |
| Garden | Roof-gardeners and window-box keepers. | Digibeings who water and spread digiflowers. |

Provisional non-war figures (all original placeholders): Speaker Ames and Lead Quorum
and Divine Concord (civic), Sister Vesper and Divine Solace (spiritual), Broker Dime
and Lead Ledgerline (commerce), Tinker Gasket and Divine Auger (invention), Prodigy Kit
and Mage Theorem (genius), Host Vinyl (culture), Windowbox (garden). In the digi
realm: Mayor Packetwright, Oracle Cursor, Broker Bitrate, Architect Patchwork, Savant
Tessel, Tapehead, Master Dewdrop and Lead Trellis. Several earlier Digi-Masters now
carry a calling too (Rootkit is a garden-keeper, Cabinet and Reel are culture, Overclock
is an inventor, Null a genius, Prism spiritual).

## Digiflowers and the gardeners who tend them

The digi realm is not only fights. **Digiflowers bloom.** Some digibeings spend their
whole existence watering and spreading them: a Dewdrop Sprite with a watering can made
of light, a Pollen Packet drifting seeds into cracks, a Seedling Daemon planting one
flower per sector and moving on. Players can sometimes catch them at it, in the hideout
garden, along a Tower sector or on a quiet route.

Provisional digiflowers: Bitbloom (Boot Sector), Lagrose (Packet Alley), Rootlily
(Canopy Stack), Neon Marigold (Neon Overflow), Glowcap (Hollow Cache), Prism Peony
(Prism Core), Nullweed (Null Basement). Later, flowers could be collectible, feed
LokPet moods, or decorate the hideout; none of that is built, this is only the lore.

All political, spiritual and business leaders in this file are fictional, never real
people or institutions.

## How to expand it

- A new named Master, Lead, Mage, Master or Divine is a row in
  `src/game/data/masterLore.ts`. The tests check ids are unique, faction ids exist,
  ranks are valid and no text uses the banned word.
- Give each figure a rank, a calling, a realm (city or digi), a place, a faction (or
  none), a one-line voice and one thing they want from the player. Gameplay can come later; the lore row is enough.
- Before wiring any of this into encounters, check `docs/lokpet-rpg-and-digi-tower-plan.md`
  section 10, which already uses Digi-Masters as the Tower's sector bosses.
