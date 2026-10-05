---
name: Lok universal player and the published soundtrack
description: How the Lokifed album is published for the GSix hub and other Lok apps, and what stays untouched in the in-game player.
---

Read before moving or renaming anything under `public/music/` or editing
`public/lok-soundtrack.json`, or changing the bundled-track list in
`src/game/audio/musicPlayer.tsx`.

## What exists

- The 12 Lokifed — Take 1 `.m4a` files live in `public/music/lokifed-take-1/`
  (moved out of `src/assets/` so they have stable public URLs; they used to
  be hashed bundle assets nothing outside the game could name).
- `public/lok-soundtrack.json` is the album as a `lok.playlist/v1` file (the
  standard is defined in the GSix hub repo, `packages/lok-music/STANDARD.md`,
  with the shared player `@lok/music`). The hub and any app that includes the
  drop-in `https://gsix.online/lok-music.js` fetch it from
  `https://survivor.gsix.online/lok-soundtrack.json`; it is the default
  playlist of every Lok Music player.
- `vercel.json` sends `Access-Control-Allow-Origin: *` for that JSON and for
  `/music/*`. Cache on the audio is one day, not `immutable`, because the file
  names are not content-hashed.
- `lokSoundtrackCatalog.test.ts` fails the suite if the JSON drifts from the
  in-game track list (ids, titles, unlock counts) or points at a missing file.

## Decisions worth keeping

- The in-game player is deliberately NOT replaced by `@lok/music`. It owns
  beat analysis, studio hand-off, albums/playlists and unlock gating; the
  shared player is a small listening widget for everywhere else.
- Each track carries `gate: { app: 'survivor616', objectives: N }`. On other
  sites a gated song opens three ways, in this order: (1) the Lok account's
  progress (`lok_music_progress`, written by `cloudSyncStore.tsx` from
  `meta.soundtrackObjectiveCompletions` while signed in, only ever upward) meets
  the gate; (2) it was earned from an hourly drop and played once, which is
  permanent (`lok_music_unlocked`, plus this browser); (3) it is this hour's
  drop, open for 60 minutes. The drop schedule is a pure function of the clock
  (`packages/lok-music/src/drops.ts` in the GSix hub repo), so it needs no
  server and everyone sees the same drop. In-game gating is unchanged and
  separate: playing a drop on the website does NOT unlock the song in the game.
  The lock is progression, not DRM: the audio URLs are public.
- Publishing is the only Survivor-side code: `lib/lok-client/src/music.ts` +
  `saveMusicProgress` in `authStore.tsx`, sent when the number rises. The hub's
  two tables are created by a hub migration (`20261005000200_lok_music_unlocks.sql`);
  without it the write fails quietly and the retry waits for the next change.
- No artist is named in the catalog on purpose (the standard supports `artist` per track or per playlist; set it only when it is true) (see
  `survivor-616-art-assets.md`): nothing is claimed that the project cannot show.
- The album is AAC/M4A as delivered. The standard's MP3 baseline applies to
  what apps import/export; `convertToMp3` here is the reference converter.
  The album files themselves were not re-encoded (lossy to lossy).
- When adding an album track: update the track list in `musicPlayer.tsx`, add
  the file under `public/music/lokifed-take-1/`, add it to the JSON.
