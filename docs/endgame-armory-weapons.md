# Endgame Armory weapons

The GRPD Armory keeps new weapons out of ordinary runs until the player earns and activates them. The first endgame shelf contains DigiFrog Lance and the three legendary Digi-Tanas. The other sealed blueprints remain design records until their combat behavior is implemented.

## Unlock cadence

Clearing every standard map opens Victory Lap and makes the endgame shelf available. Weapon milestones use lifetime enemy kills, so earlier kills count after the map gate is complete. The increments alternate **750,000, 1,000,000**, then repeat. The ordered list and intervals live in `src/game/data/grpdArmory.ts`; append an implemented weapon ID to extend the cadence. Never put an unimplemented blueprint into the playable list.

| Weapon | Lifetime kills required | Field action |
| --- | ---: | --- |
| DigiFrog Lance | 750,000 | Switch on in the Armory. |
| Firewall Verse | 1,750,000 | Switch on in the Armory. |
| Rewind Mercy | 2,500,000 | Switch on in the Armory. |
| Eclipse Severance | 3,500,000 | Switch on in the Armory. |

These four milestones unlock for every player who reaches them. They need no Evidence seal to unlock, and all four start **off** for future runs. The earlier Crossing Baton, Rivet Driver, and Deck Sling still use one Evidence seal each for fabrication. Active archive weapons may use the existing per-1,000-kill offer bonus and purchased 1×–5× tiers; neither changes damage.

## Combat and evolutions

The DigiFrog Lance carries one enemy through a tongue sweep, throws it with high impulse, and lets the thrown body bounce into other enemies. Sticky residue slows targets; nearby witnesses briefly stop and squirm under Grossed Out. Weapon levels shorten the sweep, increase throw force and bounce, extend the flying window, and lengthen both status effects. A Circuit Frog companion is welcome but not required, so this milestone remains available to everyone.

Firewall Verse draws a burning guard arc and leaves a short hot lane. Rewind Mercy marks a threat and returns it to its marked location with a second hit. Eclipse Severance cuts a violet seam that slows threats crossing it. Each has a separate pixel model and combat effect.

After Victory Lap, **Endgame weapon evolutions** is on by default in Endgame settings. Turning it off hides only these four evolution offers; the base weapons and older evolutions keep their normal rules. The recipes require a max-level base weapon, a max-level partner weapon, and one passive:

| Evolution | Base and partner at level 8 | Passive |
| --- | --- | --- |
| Tongue-Tether Typhoon | DigiFrog Lance + Chain Whip | Street Map |
| Firewall Verse: Last Bar | Firewall Verse + Boombox | Subwoofer |
| Rewind Mercy: Encore | Rewind Mercy + Turntable | Vinyl Record |
| Eclipse Severance: Closed Circuit | Eclipse Severance + Rift Arc | Backup Drive |

The Armory and Digi-Verse Archives carry the weapon and Trinity lore. The true holders of the three legendary blades are unknown.
