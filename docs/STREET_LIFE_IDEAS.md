# Street Life: ideas bank

Status: ideas only unless marked built. Built so far: boulders, power states (phase 1), rings, Ring Runs with laser rivals, Victory Tokens (this branch).
Rules: procedural art, no runtime AI, no new network calls.

## Built on this branch (Ring Runs)
- Free rings: speed (boost), coin (cred), surge (small heal, XP, boost). Passing rings in a 3.2 second window builds a chain; chain milestones at 5, 10 and 15 pay cred, 8 grants Supersonic, 12 grants Gilded, 16 fires a token blast.
- Ring fields (arc of 5 to 8 rings) and Ring Run tracks (8 to 11 gates, coins between them, a multiplier that rises per gate, two laser rivals racing beside you whose trails hurt enemies).
- Beat both rivals for first place. The finish pays a bonus and sets off the token explosion: gold (cred), red (attack up, sometimes permanent), purple (small all-stat boost), teal (Gilded plus cred and XP), green (heal), blue (overshield), white (Lok token).

## Easy wins (small, safe, high feel)
1. Pickup ding scale: every pickup in a short window raises pitch a step, like the ring chain.
2. Kill streak counter that feeds the same chain meter.
3. Screen-edge arrows pointing to the nearest ring or track start.
4. A minimap icon for tracks and ring fields.
5. Run summary line: "rings passed, best chain, tracks won".
6. Best-time record per track seed in local save (speed-run support).
7. Rival names and colors that change with the district.
8. Token magnet range grows with the Purple token count.
9. Reduced-motion version of every flash and shake (already the rule).

## Completely new things
1. **Rival rematch**: lose a track and the rivals leave a ghost trail you can race on the retry.
2. **Duet lane**: two tracks side by side; whoever finishes first steals the other's coins.
3. **Ring weather**: a district-wide event where every ring pays double for 60 seconds.
4. **Echo Run**: your own recorded path from the last run appears as a lane; beat yourself for a token blast.
5. **Moving gates**: rings on rails that sweep across the street; time them.
6. **Token vault**: a rare gold-rimmed token that opens a one-run modifier (low gravity, big magnet, double XP).
7. **Daily Run**: one seeded track a day, same for everyone.
8. **Stunt ramps**: a ramp piece that launches you over a gap into a ring chain.

## Things that work anywhere in the app or game
1. A shared combo meter and "ding scale" sound set for every Lok game.
2. A token-burst celebration component for any win screen (menus, shop, arcade, quests).
3. Overshield and attack-up icons drawn procedurally for any HUD.
4. A "daily seed" helper shared across games.
5. A codex page listing every token, ring and state, with plain-language effects.
6. An idle-friendly "claim" burst in the hideout and on game-end screens.

## Needs a backend (saved here for later)
- Shared best-time leaderboards for each track and the daily run.
- Friends' ghost trails.
- A shared daily seed.
