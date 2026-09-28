---
name: GRPD Station and the Director Terminal roadmap
description: GRPD Station, its Director terminal, SWAT Sauna, K9 counter and vault reward, plus the staged faction, Running Man, weapon, and Artiste roadmap that grew from it.
---

Read before touching `data/directors.ts`, the `DirectorPersonalityEffect`
union in `types.ts`, `HUB_ROOMS`/`ALLIES`/`DISCOVERIES` in
`data/progression.ts`, `RECOVERY_FACILITIES`/`RECOVERY_HUTS`/
`SAUNA_HOLE_REWARDS` in `data/recovery.ts`, the `'lokpet'` `VendorItemDef`
category, or the `k9-hound`/`wolf`/`digi-wolf` LokPet content in
`data/lokPets.ts`.

## What this is

The user asked for a large, multi-system content pass in one message: a
mystery screen-clearing event character ("The Running Man"), a real
expansion of the existing single-Director boss system into multiple
selectable "personalities" reached from a new police-station location, new
vendor/pet content, two new enemy factions, several new weapons, and a new
playable character with a novel draw-to-dodge ability. Given the scope,
this was explicitly staged. Stage 1 shipped first; the Director personalities,
Rapid/Data-Gob rescue thread, Supabuilda, Site Crew, GRPD Vault reward, and
Running Man slice have since shipped in focused passes. The remaining roadmap
stays below so the Clock weapon and Artiste are not lost or re-derived.

## Stage 1, built: GRPD Station + Director Terminal

### The location

One new hub room, **`grpd-station`** (`HUB_ROOMS` in `data/progression.ts`),
unlocked via `{ kind: 'discovery', discoveryId: 'grpd-station-found' }` --
that discovery is granted by clearing the new area `grpd-station-division`
(`data/areas.ts`), a normal `AreaDef` reusing only existing `ObstacleDef`
kinds and existing enemy ids (`nightcrawler`/`bloodhound`/`corner-cutter`/
`crypt-spitter`/`crypt-bouncer`), chained after `lev-syndicate-spire` via
`clearArea`.

A second room, **`grpd-vault`** ("The Vault," the user's "locked room with a
super safe door"), originally shipped as an unreachable future-content
hook. It now unlocks by clearing `site-crew-active-zone`: the Site Crew cuts
through the door at the end of its recovery thread. The room directly grants
the fixed legendary K9 **Blue 616** exactly once through
`claimLegendaryPoliceDog`; Blue has `weight: 0`, is not sold, and never enters
the rotating kennel pool.

### The Director Terminal

The user's own framing, paraphrased: Directors were "always meant to be
more than just a boss" -- secondary/tertiary personas under a larger,
unnamed controlling AI (new lore; nothing pre-existing conflicts with it).
`DirectorDef` (`types.ts`) gained two fields:
- `codexLore: string` -- shown only in the terminal, once unlocked; distinct
  from the in-run `warningText`/`victoryText` banners.
- `effect: DirectorPersonalityEffect` -- a small, bounded discriminated
  union (`{kind:'none'}` / `'spawnBias'` / `'factionFavor'`) for how a
  personality changes the run beyond which faction/boss spawns. **Stage 1
  ships only the type shape and `{kind:'none'}` for the one existing
  Director (`take-two`)** -- real tuning for personalities #2/#3 is Stage 2.

Selection is `MetaState.activeDirectorPersonalityId: string | null`
(mirrors the existing `activePaletteId` pattern exactly), consulted by
`updateDirector` in `engine/world.ts` (previously hardcoded to
`DIRECTORS[0]`; now `DIRECTORS.find(d => d.id === w.activeDirectorPersonalityId)
?? DIRECTORS[0]`, so an unset/unrecognized id preserves exactly the old
behavior). Only selectable among ids already in the pre-existing
`MetaState.defeatedDirectorIds` -- "unlock by defeating them" already
existed (`DirectorDef.unlockId`); no new unlock mechanism was needed.

UI: `ui/DirectorTerminalPanel.tsx`, modeled on `PaletteGalleryPanel.tsx`'s
"grid of cards, one is the single active choice" shape -- the closest
existing precedent for a mutually-exclusive picker (as opposed to
`RunModifiers`' multi-select checklist, which is additive/stacking and
the wrong shape here).

**Naming collision, avoid re-introducing it:** the existing hub feature
`'unlocks'` (achievements/discoveries) is *already* labeled "Archive" in
`PANEL_CONFIG` and its `Screen` variant is literally `{ name: 'archive' }`,
rendered by the pre-existing `ui/ArchivePanel.tsx`. This is a **completely
different, older feature** than the new Director terminal. The new hub
room feature literal is `'director-terminal'` (not `'archive'`), the new
panel is a separate file `ui/DirectorTerminalPanel.tsx`, and its `Screen`
variant is `{ name: 'director-terminal' }`. Mid-build, a first draft of this
panel was accidentally written to the path `ui/ArchivePanel.tsx` and very
nearly overwrote the real achievements panel; it was caught via `git status`
before committing and reverted with `git checkout`. If you're adding a
fourth hub screen whose flavor name is some synonym of "archive," grep for
`ArchivePanel`/`'archive'` first.

### SWAT Sauna and the reward hole

Reuses two *existing, separate* "roster feels better" mechanisms together,
per the user's explicit choice, rather than inventing a third:
- **Recovery**: a new `RecoveryFacilityDef` tier (`swat-sauna`,
  `data/recovery.ts`) with the highest `recoveryPctPerMinute` in the game,
  attached via a new `RecoveryHutDef` (`grpd-swat-sauna`) gated on clearing
  `grpd-station-division` -- **not** a purchasable rung on the existing cred
  ladder. This needed a real guard: `RECOVERY_FACILITIES` doubles as both
  the hut lookup table (`RECOVERY_FACILITIES_BY_ID`) *and* the source of the
  purchasable ladder (`FACILITY_ORDER`/`upgradeFacility` in
  `state/metaStore.tsx`, and the ladder listing in `ui/RecoveryPanel.tsx`).
  Appending a `cost: 0` tier to that one shared array would otherwise let
  `upgradeFacility` "sell" it for free once a player reached the last real
  rung. Fixed by excluding any `cost <= 0` tier past `'tub'` from both the
  `upgradeFacility` reducer's next-tier pick and `RecoveryPanel`'s
  `ladderFacilities` list -- the hut lookup path (`facilityForLocation`)
  is untouched and still resolves `swat-sauna` correctly by id.
- **Crew activity**: a new resident ally, **Sarge** (`sarge`,
  `room: 'grpd-station'`), with a new `CrewActivityDef`
  (`run-the-drills`, `+4% armor`) -- the permanent per-ally stat-bonus
  mechanism, unrelated to the recovery/fatigue one above.
- **The mystery hole**: a genuinely new, small mechanism -- "reach through
  the hole" (a button in `ui/RecoveryPanel.tsx`, shown only for the
  `grpd-swat-sauna` hut) dispatches `claimSaunaHoleReward`, which sets
  `MetaState.pendingSaunaReward: { weaponId: string } | null` from a new,
  deliberately tiny and extensible table, `SAUNA_HOLE_REWARDS`
  (`data/recovery.ts`, one entry today: `'baton'`, per the user's own
  "will add more weapons to this hole later"). Threaded into the next run's
  loadout via a new `createWorld` setup field, `bonusWeaponId` (mirrors how
  `worldColorPalette` is threaded from settings), added to `World.weapons`
  once at world creation (mirrors the signature-weapon construction). Reset
  to `null` unconditionally in the `completeRun` reducer, so it's scoped to
  exactly the next run whether that run is won, lost, or fled -- never a
  second chance to double-queue it.

### Rapid Guard's K9 counter

**No new vendor room or panel** -- `VendorPanel.tsx` already renders the
*entire* global `VENDOR_CATALOG` filtered only by a `category` tab, so a new
category (`'lokpet'`) was enough to give Rapid Guard his own tab in the
*same* Quartermaster screen Otis already runs (subtitle updated to name
both). `VendorItemDef` gained `grantsLokPetVariantId?: string`: on
purchase, `buyVendorItem`'s reducer (`state/metaStore.tsx`) rolls a
`SavedLokPet` from that variant (`rollLokPet(Math.random, { fixedVariantId
})`, the same "fixed" rolling entry point the codebase already used
elsewhere for deterministic pet grants) straight into the kennel, instead
of a permanent stat effect.

Two new **ordinary** (non-legendary) `LokPetVariantDef` entries,
`k9-greyhound`/`k9-shepherd` (new silhouette `k9-hound`, a `quadrupedRig()`
with a vest accent part), roll the full common/charged/rare/mythic spread
like any other pet -- per the user's explicit "rarities... common uncommon
rare" ask, they are **not** `SPECIAL_LOKPET_LOADOUTS` legendaries. A third,
`wolf` (new silhouette `wolf`), is the same ordinary shape with a low
`weight: 3` for "rare pop-up."

### Digi-Wolf

A genuinely rare one-off encounter (`digi-wolf` `EnemyDef`, `family:
'Boss'`, `behavior: 'flanker'` + `traits: { teleportMs, ghostMs }` for the
glitchy feel), authored as a very-low-`ratePerSec` wave entry in a narrow
late window of `grpd-station-division` -- not a new engine subsystem. Per
the user's own confirmation, **v1 is "defeat-then-recruit," not live
capture**: `killEnemy` in `engine/world.ts` has a dedicated branch keyed on
`enemy.defId === 'digi-wolf'` that, 70% of the time, rolls the fixed
`digi-wolf` LokPet variant (`weight: 0` -- never a normal chest roll,
`SPECIAL_LOKPET_LOADOUTS` legendary, same shape as the three starters) and
calls the same `spawnLokPet` any other pickup-triggered grant uses.

## Stage 2, built: four new Director personalities + AI-hierarchy lore

Shipped as two independent efforts that both extended the same
`DirectorPersonalityEffect` type: **4 new `DirectorDef` entries total**,
each with its own `FactionDef`/roster + `family: 'Boss'` enemy (two of
them reusing an already-registered faction instead of a new one),
following `reel-syndicate`/`the-director`'s own pattern (a faction that
only ever spawns from `data/directors.ts`, never from an area's authored
`waves`, unless noted below):

- **The Warden** (`id: 'the-warden'`, faction `prism-choir`, boss
  `prism-warden`) -- `effect: { kind: 'spawnBias', spawnRateMult: 1.18,
  hpMult: 1.1 }`.
- **The Promoter** (`id: 'the-promoter'`, faction `high-roller-syndicate`,
  boss `marquee-reaper`) -- `effect: { kind: 'factionFavor',
  favoredFactionId: 'high-roller-syndicate', spawnRateMult: 1.65 }`.
- **The Cutting Room** (`id: 'cutting-room'`, faction `cutting-room-crew`,
  boss `the-splice`) -- `effect: { kind: 'spawnBias', spawnRateMult: 1.35,
  hpMult: 0.85 }`: more enemies for the rest of the run, each individually
  squishier.
- **Continuity** (`id: 'continuity'`, faction `continuity-desk`, boss
  `the-take`) -- `effect: { kind: 'factionFavor', favoredFactionId:
  'afterimage-choir', spawnRateMult: 1.5 }`: biases a specific *existing*
  named faction to show up more throughout the run, on top of its own
  encounter roster.

**Engine mechanism:** `selectedDirector(w)` returns the `DirectorDef`
matching `w.activeDirectorPersonalityId` (no fallback -- an unset/unknown
id reads as no ambient effect). `directorHpMult(w)` returns a `spawnBias`
director's `hpMult` (else `1`), applied once, uniformly, inside
`spawnEnemy`'s hp formula alongside `modifierHpMult(w)` -- so it affects
*every* spawn path (normal waves, bursts, endless mode) with no
per-call-site duplication. `directorWaveSpawnMult(w, factionName?)`
returns a `spawnBias` director's `spawnRateMult` unconditionally, or a
`factionFavor` director's `spawnRateMult` **only when `factionName`
matches `getFaction(effect.favoredFactionId).name`** -- folded into
`updateSpawning`'s `spawnMultiplier` via `wave.faction`. This means
`factionFavor` biases an *area's own authored, faction-labeled waves*
(e.g. `back-alley`'s corner-cutter wave already carries `faction:
'Afterimage Choir'`) rather than injecting a faction that isn't authored
into that area at all. **Endless mode gets no director-effect wiring at
all** (a known gap, not silently patched over). `updateDirector`'s own
encounter-trigger fallback, when no personality is selected, picks a
**random** registered Director rather than always `DIRECTORS[0]` -- keeps
every personality discoverable/unlockable through ordinary play once
there are several.

`DirectorTerminalPanel.tsx` has an `effectReadout(director)` helper
(renders what `spawnBias`/`factionFavor` actually does, plus a "Can cut in
after M:SS" line from `triggerAfterSec`) and a framing paragraph that
names (without ever fully explaining) an unnamed process a few tiers up
that greenlights which Director personality runs a scene next.

**Cautionary tale, read this if you're about to touch `directors.ts`/
`factions.ts`/`enemies.ts`/`world.test.ts` near Director content:** this
exact Stage 2 section, plus the whole music-driven-events feature
(`data/musicEvents.ts`), a mobile-audio resume fix, and a soundtrack
artist-backlinks feature, were **silently deleted from `main`** by a later
PR (GRPD K9-counter exposure) whose branch was based on a stale snapshot
predating all of it -- not a real 3-way merge, a wholesale file overwrite
that dropped ~900 lines across 19 files with no conflict ever surfacing,
because the deleting commit had a single parent and GitHub's merge never
flagged it. It was caught by comparing `DIRECTORS.length` before and after
and tracing the git graph commit-by-commit, then restored via the same
`git merge-file` three-way-merge technique (current tip as "ours", the
pre-deletion commit as "base", the pre-deletion-but-with-content commit as
"theirs") rather than hand-copying, so anything legitimately added *after*
the deleting commit was preserved automatically. If you're merging a
branch whose base predates recent `main` history, diff your branch's
content registries (`DIRECTORS.length`, `FACTIONS.length`, etc.) against
current `main` before and after merging -- a line-level 3-way merge only
catches conflicts where both sides touched the *same lines*, not "one side
deleted content the other side never touched."

## Roadmap status after focused follow-up passes

- **Stage 3 -- core thread built, broader roster remains expandable**: the Rapid faction (human resistance -- riot team, gardeners,
  fighting dogs/rare cats, firefighters, teachers, bar owners, retired
  people, scared residents, briefcase-throwing management, and military
  veterans in base/Vietnam("tropical")/Iraq("dusty") flavor variants, plus
  a veterinarian role paired with the animal allies). Their camp, reachable
  only via handcrafted "digi-watch" teleport devices and never enterable
  for combat, is its own travel/venue concept distinct from a normal
  `AreaDef` arena -- **that whole system is out of scope**, ship the
  faction as ordinary combat content first. The friendly "Digi-Tablet" AI
  companion is lore/flavor only; factions have no non-combat NPC slot today.
- **Stage 4 -- built**: two rival factions -- a bodybuilder faction (proposed name
  **Supabuilda**, gym-culture puns) and a separate construction-worker
  faction ("the real builders," proposed name **The Site Crew** or **Local
  616**) -- plus the **gym membership** and **throwing weight** weapons as
  this faction's signature flavor.
- **Stage 5 -- built**: **The Running Man** is a rare one-off `World` event,
  not an ambient actor and never an `EnemyDef`. `World.runningMan` owns the
  deterministic `waiting -> warning -> running -> complete` phase machine on
  a separate RNG stream, so it cannot perturb normal gameplay rolls. The
  runner crosses a player-centered straight line and uses signed
  perpendicular distance to throw enemies and movable props to opposite
  sides exactly once. He never enters `w.enemies`, so targeting, damage,
  capture, kill credit, and Bestiary systems cannot see him. The renderer is
  procedural Canvas2D with a lane telegraph, speed trails, and a compact
  pixel runner.
- **Stage 6 -- built**: **Clock** is a data-only `WeaponDef` using the existing
  wave system. It releases three lime clock-hand sweeps 120 ms apart and
  applies the existing bounded slow status on hit. It joins the normal weapon
  pool and Threat Matrix catalog automatically, without borrowing or changing
  the Clockwork Beetle's hazard-pause identity.
- **Stage 7 -- built**: **Artiste** and the **Living Line** weapon complete
  the roadmap. An Artiste-only Draw button arms `PointerMode: 'draw'`; the
  next mouse/touch drag records a bounded freeform `World.artisteDraw`
  polyline and displays it through a live SVG stroke. Release performs one
  invulnerable dodge to the collision-resolved endpoint and damages each
  crossed hostile once. Short/cancelled marks are free, while successful
  routes start the authored cooldown. See `artiste-draw-dodge.md`.
