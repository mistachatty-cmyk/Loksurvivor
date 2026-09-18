# LokSurvivorArena — concept skeleton (2026-09-18)

New shared-arena "most kills wins" mode: 2-4 players in one arena, local
multiplayer working today, real networked multiplayer planned as a later
phase. Lives inside `artifacts/survivor-616` for now (agreed to split into
its own package once the concept proves out).

## The one load-bearing scope cut

Full per-player weapon loadouts, leveling, and evolutions would mean
parameterizing `fireWeapon`/`rebuildOrbiters`/the evolution system by player
throughout `world.ts` — a large invasive rewrite, not a skeleton. Instead:

- The **host** (`w.player`, `w.weapons`) is unchanged — full campaign combat,
  leveling, evolutions, the works. Host kills still count in `w.kills`
  exactly as before; nothing about the single-player path changed.
- **Guests** (`w.guests: GuestPlayerActor[]`, new in `engine/world.ts`) are a
  separate, much lighter actor: real movement/collision physics (reuses
  `collideObstacles`/`clampToArena`/`applyKnockback`, the same helpers
  `updatePlayer` uses — see `updateGuest`), but a single fixed melee pulse
  instead of a `CharacterDef` weapon (`GUEST_ATTACK_RANGE`/`_INTERVAL_MS`/
  `_DAMAGE` in `world.ts`, next to `updateGuest`). No leveling, no evolutions,
  no per-guest `RunWeapon` array.

This is why the plan's original idea of threading a `killerId`/`ownerId`
through all 29 `damageEnemy()` call sites (every projectile/effect/orbiter
hit) never happened: only `updateGuest`'s own damage call passes `killerId`.
`damageEnemy`/`killEnemy` gained one optional trailing `killerId?: string`
parameter each — every existing call site is unaffected (undefined by
default), and when set, `killEnemy` adds to the new `w.guestKills[id]` map
*in addition to* incrementing the existing global `w.kills`/`w.killsByEnemy`
exactly as before. If a future pass wants the host's own weapon kills
individually attributable (for real host-vs-guest scoring symmetry, or
multi-host networked play), that's the remaining work — thread `ownerId`
through `Projectile`/`Effect`/`Orbiter` at their creation sites and the ~10
collision-resolution call sites that read them, not all 29.

## What's additive and what's new

Additive to `world.ts` (single-player untouched, `world.test.ts` fixtures
unaffected): `World.guests`/`arenaMode`/`guestKills`, `PlayerActor`
unchanged, `StepInput.guestInputs?` (optional, campaign callers never set
it), `damageEnemy`/`killEnemy`'s trailing optional param, the camera-target
calc in `stepWorld` (centroid of host+guests only when `arenaMode`), and one
new exported `addGuestPlayer(w, id, character, x, y)` next to `createWorld`.

New, arena-only: `game/arena/arenaWorld.ts` (`createArenaWorld` — calls
`createWorld` then `addGuestPlayer` per extra seat), `game/arena/
arenaInput.ts` (host WASD/arrows + guest-1 IJKL keyboard pair + Gamepad API
for seats 2-3, all local-device only), `game/arena/scoreboard.ts`
(`arenaStandings` read model), `game/ArenaScreen.tsx` (sibling to
`RunScreen.tsx`, modeled on `ui/AttractMode.tsx`'s much leaner
`createWorld`/`stepWorld`/`renderWorld` loop rather than RunScreen's full
meta/music/clip-recorder machinery — arena mode doesn't need any of that
yet). `render/draw.ts` gained one `drawGuests` function, called right after
the existing `drawPlayer()` — deliberately *not* interleaved into the
existing enemy y-sort painter's-order loop, so a guest can occasionally draw
in front of/behind a nearby enemy it shouldn't. Cosmetic only, acceptable
for the skeleton.

## Not built yet (explicit backlog, not forgotten)

- **Networking.** `StepInput.guestInputs` is already shaped so a WS layer
  fills it from remote messages instead of `arenaInput.ts`'s local polling —
  no `World`/`StepInput` redesign needed when this lands. Recommended
  backend: a hand-written `ws` relay in a new `artifacts/arena-server`
  package, deployed to Fly.io (not Replit's autoscale target — wrong shape
  for long-lived stateful sockets; not a managed realtime SaaS — this needs
  a process that can eventually run the sim authoritatively, not just
  broadcast diffs). Host-authoritative input relay, not full server-side
  physics, for the first real pass; room codes via a `?room=` URL param, no
  accounts.
- **Menu wiring.** `ArenaScreen` takes `area`/`seats`/`onExit` as props and
  isn't wired into the game's mode-select UI yet — a caller has to construct
  it directly today.
- **Guest character choice UI**, ready-up flow, and a real "1-4" seat picker
  — `ArenaScreen` currently takes a fixed `seats` array.
- **Per-host-weapon kill attribution** and true PvP (explicitly out of
  scope per the user's original ask — kill-count competition only).
