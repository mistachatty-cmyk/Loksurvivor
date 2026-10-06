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

## Networking — built (2026-10-05)

The Fly.io `ws`-relay plan below (kept struck-through for history) never
shipped and should not be revived as written: Fly.io killed its free tier
in 2024 (always-on now costs ~$2/mo minimum), which fails this feature's
explicit zero-cost requirement. What actually shipped instead:
`game/arena/arenaNet.ts`, a thin relay over **Supabase Realtime broadcast**
on the `lokClient` already connects to for LokTokens (`LokServices`
project) — no new servers, no new infra, no new bill, ever; the free tier's
~200 concurrent connections / 2M msgs/month is far more than this needs.

Design, matching the struck-through plan's own "host-authoritative input
relay, not full server-side physics" instinct, just over a different
transport: the host relays the merged per-tick input vector
(`{moveX, moveY}` per seat) plus the authoritative `{time, kills,
guestKills, outcome}` counters on a channel named `arena:<CODE>`. Every
client — including the host — runs its own full local `stepWorld` off
that shared input; **no enemy/actor state ever crosses the wire** (it would
mean serializing `EnemyActor`'s ~40 fields, several not JSON-safe, e.g.
`Set<number>` hit-tracking). This means two screens' enemy swarms can drift
slightly apart over a long match (`world.ts` has 2 unseeded `Math.random()`
calls, so true bit-exact lockstep was never on the table either) — an
accepted tradeoff, not a bug, because the scoreboard shown on *every*
screen is always the host's broadcast numbers, never a client's own local
kill count, so "who's winning" never disagrees between screens even when
the background swarm looks slightly different.

Room codes are 5-char client-generated strings (no server-side allocation
— joining the same Realtime channel name *is* the room), shareable as
`?room=CODE` (handled unconditionally in `App.tsx`'s `initialScreen`, not
gated behind dev-only like the rest of that function, since a real player's
invite link has to work in production). `ArenaSetupScreen.tsx`'s
"Online — host a room" mode owns the whole lobby lifecycle (room creation,
accepting joiners, assigning `p2`/`p3`/`p4` seat ids, starting the match);
the new `ArenaJoinScreen.tsx` mirrors it for a guest. Both hand a live
`ArenaNetRole` object into `ArenaScreen` once the match actually starts —
`ArenaScreen` itself never manages the lobby, only a fully-formed match.

**LokTokens earn also generalized**: the old hardcoded
`standings[0]?.id === 'host'` check is now `standings[0]?.id === mySeatId`,
where `mySeatId` is `'host'` for the host (local or online) and the host-
assigned seat id for a remote guest (`net.room.getSeatId()`). A remote
guest is its own signed-in session on its own device, unlike a local
shared-keyboard/gamepad guest, so it can validly earn its own
`arena_match_win` now. Shared-device local guests still can't earn —
nothing changed for them.

**Known gap, not yet built:** no explicit host-side moderation/kick, no
reconnect-on-drop handling (a guest's dropped websocket just stops
receiving ticks — the match doesn't pause or error, it just stalls for
that one player), and no lobby cap enforcement beyond `ARENA_MAX_PLAYERS`.
Fine for a casual party-game first pass; worth hardening if online mode
sees real use.

## Not built yet (explicit backlog, not forgotten)

- ~~**Networking.** `StepInput.guestInputs` is already shaped so a WS layer
  fills it from remote messages instead of `arenaInput.ts`'s local polling —
  no `World`/`StepInput` redesign needed when this lands. Recommended
  backend: a hand-written `ws` relay in a new `artifacts/arena-server`
  package, deployed to Fly.io (not Replit's autoscale target — wrong shape
  for long-lived stateful sockets; not a managed realtime SaaS — this needs
  a process that can eventually run the sim authoritatively, not just
  broadcast diffs). Host-authoritative input relay, not full server-side
  physics, for the first real pass; room codes via a `?room=` URL param, no
  accounts.~~ Superseded — see "Networking — built" above.
- **Menu wiring — done.** `HubScreen`'s main-floor room has a third button
  (`onOpenArena`, next to Sanctum computer / Sector Command, same
  `activeRoom.id === 'main-floor'`-gated pattern) opening a new
  `src/ui/ArenaSetupScreen.tsx`: an area dropdown, a 2-4 seat stepper, and a
  per-seat character `<select>` (filtered to `meta.unlockedCharacterIds`) —
  the "genuinely new component" flagged below, since no multi-character-
  selection UI existed anywhere else to adapt. Its `onLaunch(area, seats)`
  feeds two new `App.tsx` `Screen` variants (`'arena-setup'`/`'arena'`,
  mirroring the `'sector-command'` case exactly) that mount `ArenaScreen`.
  Seat ids are `'host'`/`'p2'`/`'p3'`/`'p4'`, matching what `killEnemy`'s
  `killerId` and `arenaStandings` already expect.
- **Ready-up flow** (confirm-before-launch beyond the picker's own launch
  button) is still unbuilt — not needed for a local-only skeleton where the
  host launches for everyone at the same keyboard.
- **Per-host-weapon kill attribution** and true PvP (explicitly out of
  scope per the user's original ask — kill-count competition only).
- **Networking** (see above) remains the only large piece left.
