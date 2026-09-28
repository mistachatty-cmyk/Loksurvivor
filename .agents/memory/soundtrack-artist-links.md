---
name: Soundtrack artist backlinks (cross-promotion)
description: Optional per-song/per-album backlink to an artist's own page, revealed by a click-to-expand micro-animation; step one of a larger cross-promotion/ads plan that is otherwise unbuilt.
---

Read before touching `Track.creditLabel`/`creditUrl`, `setTrackCredit`/
`clearTrackCredit`/`setAlbumCredit`/`clearAlbumCredit` in
`src/game/audio/musicPlayer.tsx`, or the credit-link UI in
`src/ui/MusicPanel.tsx`.

## What this is

The user is going to start adding other artists' songs to the soundtrack and
wants a cross-promotion mechanic: an optional backlink to wherever that
artist/album lives (their own page, store, etc.), settable per song or once
for a whole album. In the Soundtrack panel, clicking a chevron on a track row
expands a small animated panel underneath showing that link (or, for a local
track with none set, an "Add artist link" affordance) -- this is the "drop a
link underneath as a micro animation" the user asked for. The link opens in
a new tab; nothing about it is tracked or monetized.

This is stated by the user to be **step one** of a larger plan that will
eventually reach other apps in this monorepo and eventually carry paid ads.
Neither of those exists yet and neither should be inferred from this pass --
see "Explicitly out of scope" below.

## Keying scheme

Two persisted maps, `localStorage`-only (no IndexedDB/metaStore changes),
mirroring the existing `favoriteFingerprints` pattern one section up in the
same file:

- `trackCredits` (`survivor616.track-credit-links.v1`) -- keyed by
  `track.fingerprint ?? track.id`. Local (player-added) tracks use their
  device-file fingerprint, same as favorites, so the link survives a
  duplicate re-import. Bundled tracks (no fingerprint) key by their stable
  id instead.
- `albumCredits` (`survivor616.album-credit-links.v1`) -- keyed by the
  existing free-text `Track.album` grouping field (e.g. `'Lokifed — Take
  1'`). This is the "or set it once for the whole album" half of the ask:
  `setAlbumCredit` applies a link to every current track sharing that album
  name that has no link of its own.

A track's effective credit is its own `trackCredits` entry if set, else its
album's `albumCredits` entry, else none (`withCredit` in `musicPlayer.tsx`).
This merge has to be applied at every site that constructs a `Track` --
initial bundled-track state, the IndexedDB local-track restore effect, and
`addFiles` -- the same three sites `favorite` was already threaded through,
so a new construction site for `Track` needs the same treatment.

`removeCredit` (in `MusicPanel.tsx`) clears both the track-level and
album-level entry for that track's album in one action, rather than making
the player figure out which level is actually supplying the visible link.

## Why `localStorage`, not `localTrackLibrary.ts`/IndexedDB

`localTrackLibrary.ts` stores the actual file bytes and is keyed by track id
with a schema migration path (see `soundtrack-import.md`). A credit link is
small, optional metadata that needs no file-store schema change -- the
favorites precedent already proves a fingerprint-keyed `localStorage` map is
the right weight for "extra fact about a track that survives reload."

## Explicitly out of scope (not built)

- Any actual ad placement, impression, or paid-promotion mechanism -- this
  pass is the backlink only.
- Propagating this to any other artifact in the monorepo (`api-server`,
  `mockup-sandbox`, `lib/*`) -- 616 Survivor's Soundtrack panel only.
- Server-side link tracking/click analytics -- stays fully client-side like
  the rest of the soundtrack system; nothing here talks to a backend.
