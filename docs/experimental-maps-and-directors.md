# Experimental maps and Director spectacles

Status: design specification. The Experimental playlist and map type badges are implemented in `ui/AreaSelect.tsx`. The encounters and world shapes below are proposals; they are not playable yet.

## North star

A run should be remembered as a place and a story: where the player went, which route they chose, what the world did in response, and how they survived a Director's intervention. Enemy count and HP remain tuning tools, but they cannot carry a larger map by themselves.

Keep Standard as the dependable authored campaign. Experimental gathers Bonus, 2×, 4×, Classic, Infinite, and custom routes under one additional picker view. Every card names its map type. Preserve the existing category views and unlock rules. A playlist is a discovery surface, not a new difficulty multiplier or progression gate.

## Map types and promises

| Badge | Player promise | Map design rule |
| --- | --- | --- |
| Standard | A focused district with an authored climax | Strong landmark, legible loops, two viable routes |
| Bonus | A surprising rule or visual premise | One memorable mechanic that changes movement or combat |
| 2× Arena | A longer trip through a familiar district | Two or three connected zones, a midpoint event, and a destination |
| 4× Arena | A large expedition with changing fronts | Four or more distinct regions, travel goals, and local threats |
| Classic | The original compact survival rhythm | Keep its original pacing and identity intact |
| Infinite World | A journey whose route the player shapes | Seeded blocks, useful landmarks, and recurring route choices |
| Custom | A player-authored experiment | Show its object count, duration, and validation status |

The badge describes topology and pacing. It must not claim that a map is procedurally assembled when it is authored.

### First map prototypes

1. **Monroe Strip, standard:** one shop opens midway. Inside is a valuable cache and a narrow escape; outside offers space but no cache. Both routes lead back to the same final wave.
2. **Fulton, 2×:** move between an alley, a courtyard, and a roof access lane. A Director can close one lane temporarily, while another stays traversable.
3. **Abyssal subway, 4×:** a station concourse, platforms, maintenance tunnel, and power room. Restore power or wait for a train to reach extraction. A timetable makes the huge floor meaningful.
4. **Infinite streets:** offer two marked destinations every few blocks: a safer resupply or a dangerous rescue. The chosen route leaves a persistent, seed-derived mark on the minimap for that run.

## Director design: a storyteller with a visible hand

The current Directors are rare timed squad invasions with a small persistent modifier. The original map can end before their 150–180 second eligibility window. The proposed system treats each Director as a run author with an identity players can recognize before the boss appears.

Every Director gets a **deck** of event cards, not one fixed script:

- **Tell:** a 2–4 second warning, distinct audio cue, map marking, and readable icon. Never rely on color alone.
- **Intervention:** one map rule plus one enemy action. The player can respond through movement, target priority, or an interactable object.
- **Peak:** a signature wave or boss supported by the changed map.
- **Aftermath:** a short recovery window, a visible reward or route opening, and a record in the run recap.

Use a bounded pressure budget to choose cards. Count current enemy pressure, player health, recent damage, available lanes, and time since the last setpiece. A Director may become theatrical when the player is thriving and ease off after a near defeat. Avoid several unavoidable hazards at once. A selected personality at the terminal should be guaranteed to appear on an eligible run, with its arrival scaled to the map's duration; natural invasions remain varied. This is the RimWorld-inspired storyteller principle: pacing and personality, expressed through this game's action combat.

### Personality decks

| Director | Map intervention | Enemy and visual identity | Player response |
| --- | --- | --- | --- |
| **The Director** | Tilts the *rendered* world a few degrees and shifts marked cover lanes; collision and aiming remain in world coordinates | Reel Syndicate entrance, enemies pop in with a frame-skip animation, then a staged boss reveal | Follow floor arrows to a stable pocket or break the projector prop |
| **The Warden** | Drops temporary gates and marked bomb canisters around the player, leaving at least one open escape lane | Prism Choir containment wave; heavy units protect the gate controls | Destroy a control box or survive until lockdown ends |
| **The Promoter** | Turns one landmark into a lit arena with a payout meter and timed supply drops | High Roller waves arrive in announced acts; explosions chain through marked props | Fight in the spotlight for a better reward or leave and accept a smaller one |
| **The Cutting Room** | Creates short-lived duplicate enemy entrances and a harmless visual jump cut between beats | Many lighter enemies burst in with exaggerated pop and defeat effects | Break the editing consoles to reduce the duplication rate |
| **Continuity** | Replays one earlier wave from this run, then alters one prop or route so it is not a simple repeat | Afterimage Choir returns with a new escort target and visible rewind ghost | Identify the changed route and interrupt the escort |

**The Running Man** is already a separate world event. A Director card may summon it as a crossover, with its existing warning and lane sweep, but must not duplicate its simulation or trigger it during another unavoidable lane hazard.

Rain, screen shake, pop animation, and tilt are presentation layers with per-device limits. Full-screen rain should convey a change in visibility and mood without hiding enemy tells. Reduced-motion settings replace tilt, rapid cuts, and pop scaling with a stable overlay and clear warning. Bombs show fuse, blast area, and safe route before detonation. Exploding enemies use the normal kill and reward path and display a distinct pre-death cue. On phones, preserve the player and nearest threats as the visual priority.

### Data and engine boundary

Keep personality content in `data/directors.ts`. Add typed event cards describing trigger, warning, duration, map operation, faction wave, and cleanup. Use one Director event runner rather than five bespoke branches in `engine/world.ts`. The runner owns a single active spectacle, a cooldown, and a pressure budget. Rendering reads the event state; it does not drive collision. Spawned props and enemies need stable IDs, cleanup on run end or scene transition, and a seed for replay. Test that a safe lane remains, a boss can be reached, events stop cleanly, and the same seed produces the same card order.

Start with one complete deck, preferably the Warden: gate, bomb canister, Prism wave, aftermath. Playtest it before expanding the other four. A Director should feel bigger because it changes the arena and the player's plan, not because every event is louder.

## Larger maps without nested boxes

Current timed maps are bounded rectangles with placed obstacles. Endless blocks already have seeded buildings and navigable crossings. The next map grammar should generate **district regions and connections first**, then dress them with props:

1. Choose a region graph: streets, plazas, transit platforms, courtyards, riverbanks, rooftops, and interiors. Include loops and at least two routes between major goals.
2. Reserve a traversable spine and alternate route before placing collision. Validate player, enemy, boss, and exit reachability at their actual radii.
3. Place landmarks, objectives, cover clusters, hazards, and spawn fronts. Fill scenery last.
4. Vary silhouette, elevation cues, lighting, and ambience by region. Do not make every region four corner buildings around the same open square.
5. Stream and cull distant regions in large or endless worlds. Keep coordinate-derived crossings and return positions stable when regions unload.

Use authored macro layouts with seeded micro variation for Standard and 2×. Use a region graph plus authored setpieces for 4×. Keep Infinite's deterministic 640-unit navigation grid initially, but allow multi-block landmarks and occasional open plazas or winding streets within that grid. The grid is a technical unit, not an obligation to show a square room to the player.

Map size should be earned by traversal. Track time spent crossing empty space, distance to the next meaningful decision, route diversity, and whether the minimap makes the next goal obvious. If the 4× version mostly adds running time, cut area or add a new destination.

## Object and art direction

Preserve the supplied art. Build new playable props as a coherent kit that reads at gameplay zoom: clear silhouette, contact shadow, material palette, damage state, and an interaction cue. Prioritize doors, cars, gates, fuse boxes, barriers, caches, and exits. Give each district a small set of signature objects and one animated environmental landmark. Decorative clutter should not hide pickups, enemies, or bomb warnings. Use the existing object kinds and collision behavior where possible; introduce a new kind only when gameplay needs one.

## Delivery order and acceptance

1. **Playlist presentation:** Experimental overview and type badges; old filters, unlocks, and launch behavior remain intact. This is the current code change.
2. **Director vertical slice:** one full Warden deck, readable hazards, safe-lane validation, reduced-motion behavior, and recap entry.
3. **Map grammar prototype:** one Standard map and one 4× map rebuilt as connected regions with objectives. Compare travel time, route choice, and performance with the originals; keep the originals selectable during testing.
4. **Expansion:** complete other Director decks, add multi-block endless landmarks and dungeon room choices, then tune rewards and difficulty from playtest evidence.

Each slice should get a device playtest on desktop and phone. Check seeded replay, collision, enemy caps, frame time, route reachability, reward economy, and whether players can explain what the Director did after the run.
