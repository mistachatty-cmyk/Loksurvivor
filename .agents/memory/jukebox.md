# Jukebox Room (2026-10-22)

Spec and handoff log: `docs/jukebox-spec.md`. Shared logic: `packages/lok-jukebox` (`@lok/jukebox`).

- Theater levels: L1 UI full + dampen 3.5 for 4 s after a touch, L2 UI 0.35 + dampen 1.5 for 20 s, L3 UI hidden + dampen 0 until touched. Rules live only in `theater.js`.
- Dampen filters sit AFTER the analyser (`setTheaterTone` in `musicPlayer.tsx`). Never move them before it: beat detection and the room's color grade must see the true sound. Never add a second AnalyserNode; read `beatBus`.
- First touch at L3 only wakes the room (capture-phase swallow in `JukeboxRoom.tsx`).
- Unlock: `arcade-box` discovery, granted only when `arcade-high-score` is already known. The Arcade Box spawns every Neon Arcade run. `?jukebox` previews the room in any build.
- The id `pulse-jukebox` is a hideout prop that opens the Soundtrack panel; the room is `jukebox-room`. Do not merge them.
- Discs are procedural (`jukeboxDiscs.ts`); locked tracks show as sealed discs. No artist or licensing text on discs.
- Opt-in arrival discs: Settings row, flag `survivor616.arrival-discs.v1`.
