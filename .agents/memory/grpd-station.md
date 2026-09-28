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

## Roadmap status after focused follow-up passes

- **Stage 2 -- built**: real `DirectorPersonalityEffect` tuning for 2 more
  `DirectorDef` entries (new faction rosters + bosses each), and the actual
  "who/what controls the Directors" lore paragraph written into the
  terminal's framing text.
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
- **Stage 6**: the **Clock** weapon (data-only).
- **Stage 7**: the **Artiste** character and its draw-to-dodge weapon --
  the single largest remaining lift, deliberately last. Not data: a new
  `PointerMode: 'draw'`, a new `World.artisteDraw` state capturing an
  arbitrary polyline (Zero Day's `freezeSelectBox`/`updateFreezeSelection`
  only ever handles an axis-aligned rectangle, per
  `zero-day-freeze-throw.md` -- it doesn't generalize to a freeform path),
  and a live-stroke render layer (an SVG overlay or a second always-cleared
  canvas, since the existing one-`div` DOM-overlay technique can't draw a
  polyline). Follow the Zero Day precedent's proven shape (opt-in
  `CharacterDef` field, dedicated `World` runtime state, a new `PointerMode`
  value) rather than `DashSkillDef`/`UltimateDef.effect`, both proven poor
  fits for anything stateful across input frames.
