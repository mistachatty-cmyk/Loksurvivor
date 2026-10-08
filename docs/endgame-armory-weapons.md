# Endgame Armory weapons

The GRPD Armory keeps new weapons out of ordinary runs until the player earns and activates them. Volume I contains ten playable endgame weapons: DigiFrog Lance, the three legendary Digi-Tanas, and six more designs from the sealed shelf. Later-volume blueprints remain design records until their combat behavior is implemented.

## Unlock cadence

Clearing every standard map opens Victory Lap and makes the endgame shelf available. Weapon milestones use lifetime enemy kills, so earlier kills count after the map gate is complete. The increments alternate **750,000, 1,000,000**, then repeat. The ordered list and intervals live in `src/game/data/grpdArmory.ts`; append an implemented weapon ID to extend the cadence. Never put an unimplemented blueprint into the playable list.

| Weapon | Lifetime kills required | Field action |
| --- | ---: | --- |
| DigiFrog Lance | 750,000 | Switch on in the Armory. |
| Firewall Verse | 1,750,000 | Switch on in the Armory. |
| Rewind Mercy | 2,500,000 | Switch on in the Armory. |
| Eclipse Severance | 3,500,000 | Switch on in the Armory. |
| Cipher Cathedral | 4,250,000 | Switch on in the Armory. |
| Subwoofer Railstaff | 5,250,000 | Switch on in the Armory. |
| Commentstorm Crown | 6,000,000 | Switch on in the Armory. |
| Pitch Reaper | 7,000,000 | Switch on in the Armory. |
| Cache of Lost Hooks | 7,750,000 | Switch on in the Armory. |
| Breakpoint Hands | 8,750,000 | Switch on in the Armory. |

These ten milestones unlock for every player who reaches them. They need no Evidence seal to unlock, and all ten start **off** for future runs. The earlier Crossing Baton, Rivet Driver, and Deck Sling still use one Evidence seal each for fabrication. Active archive weapons may use the existing per-1,000-kill offer bonus and purchased 1×–5× tiers; neither changes damage.

## Combat and evolutions

The DigiFrog Lance carries one enemy through a tongue sweep, throws it with high impulse, and lets the thrown body bounce into other enemies. Sticky residue slows targets; nearby witnesses briefly stop and squirm under Grossed Out. Weapon levels shorten the sweep, increase throw force and bounce, extend the flying window, and lengthen both status effects. A Circuit Frog companion is welcome but not required, so this milestone remains available to everyone.

Firewall Verse draws a burning guard arc and leaves a short hot lane. Rewind Mercy marks a threat and returns it to its marked location with a second hit. Eclipse Severance cuts a violet seam that slows threats crossing it. Each has a separate pixel model and combat effect.

Cipher Cathedral arranges three slowing glyph nodes and cutting edges around a crowd; its evolution doubles the enclosure. Subwoofer Railstaff plants three staggered bass rails; the evolved form lays five. Commentstorm Crown orbits the survivor and answers each contact with a small punctuation burst. Pitch Reaper cuts outward with a chord and returns along the same lane. Cache of Lost Hooks replays three delayed slowing circles, while Breakpoint Hands interrupts with two hard-light blows. Their evolutions increase the reach, layers, or number of beats.

After Victory Lap, **Endgame weapon evolutions** is on by default in Endgame settings. Turning it off hides these ten evolution offers; the base weapons and older evolutions keep their normal rules. The recipes require a max-level base weapon, a max-level partner weapon, and one passive:

| Evolution | Base and partner at level 8 | Passive |
| --- | --- | --- |
| Tongue-Tether Typhoon | DigiFrog Lance + Chain Whip | Street Map |
| Firewall Verse: Last Bar | Firewall Verse + Boombox | Subwoofer |
| Rewind Mercy: Encore | Rewind Mercy + Turntable | Vinyl Record |
| Eclipse Severance: Closed Circuit | Eclipse Severance + Rift Arc | Backup Drive |
| Cipher Sanctuary | Cipher Cathedral + Triangle Liturgy | Steel Toe |
| Bassline Overdrive | Subwoofer Railstaff + Mile Marker | Subwoofer |
| Crown of Replies | Commentstorm Crown + Turntable | Gold Chain |
| Requiem Return | Pitch Reaper + Chain Whip | Vinyl Record |
| Chorus Cache | Cache of Lost Hooks + Boombox | Backup Drive |
| Breakpoint Finale | Breakpoint Hands + Freestyle Mic | Steel Toe |

The Armory and Digi-Verse Archives carry the weapon and Trinity lore. The true holders of the three legendary blades are unknown.
