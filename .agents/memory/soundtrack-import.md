---
name: Soundtrack import (video files, links, MP3 conversion)
description: Why dropped video files play without transcoding, what "add a link" is and isn't, and how in-browser MP3 conversion works.
---

Read before touching `addFiles`/`addFromUrl`/`convertTrackToMp3` in
`src/game/audio/musicPlayer.tsx`, `src/game/audio/convert.ts`, or the
add-tracks/add-link controls in `src/ui/MusicPanel.tsx`.

## Video files play immediately, with no conversion step

An `<audio>` element playing a `.mp4`/`.mov`/`.webm`/`.mkv` file's object URL
just plays its audio track -- browsers demux the container and ignore the
video stream. So a dropped video file becomes a normal `Track` the moment
it's dropped (`isVideoContainer: true`, `source: 'local'`); there is no
"please wait, converting" step between drop and playable. Don't add one.

## "Convert to MP3" is opt-in, and works on the same principle

`convertToMp3` (`convert.ts`) decodes with `context.decodeAudioData` -- the
same call `studio/importer.ts` uses, and for the same reason it demuxes a
video container down to audio-only: nothing about that call cares whether
the source was an audio or video file. `@breezystack/lamejs` then encodes
the decoded PCM to a real `.mp3` Blob, which replaces the track's `url` in
place (same id, so a playlist referencing it doesn't break).

This exists for players who want a real portable MP3 -- smaller, and
guaranteed to decode next time -- not because playback needs it. Chosen over
`ffmpeg.wasm`: no ~25MB WASM payload, no CDN fetch, pure JS, dynamically
imported so it never lands in the bundle for a player who never converts
anything.

## Link import is "paste a URL to a file you already control," not a downloader

`addFromUrl` fetches a URL client-side and treats the result exactly like a
dropped file. That only ever works for a direct link with permissive CORS --
a player's own Drive/S3/CDN link. It is not a downloader:

- **A hard-coded host blocklist** (`STREAMING_SERVICE_HOSTS`) refuses
  YouTube/Spotify/SoundCloud/Apple Music/Tidal/Deezer links before ever
  attempting a fetch, with a message pointing at "save the file and drop it
  in instead."
- **Nothing here should ever grow into a yt-dlp/spotDL-style backend.** That
  was proposed once and declined: it needs a persistent server this static
  game doesn't have (`artifacts/api-server` is an unwired health-check
  stub), and spotDL specifically routes around Spotify's DRM to source audio
  elsewhere -- unauthorized redistribution of other people's commercial
  music, not "the player's own file," and not something to build regardless
  of how the request is phrased.
- A CORS-blocked fetch throws with no useful detail (the browser can't tell
  a blocked request from a network failure), so the catch-all error message
  stays generic and points at the same fallback: download it, then drop it.

This is the same constraint `survivor-616-art-assets.md` already documents
for the soundtrack generally -- links extend *how* a player hands over a
file they already control, not *whose* files play.

## Playlists store track ids, not tracks

A `Playlist` is `{ id, name, trackIds }`; the id list is resolved against
the live `tracks` array at read time (`activeQueueIds`), and any id that no
longer resolves is silently skipped rather than shown broken -- the same
"reference, don't carry, skip what's missing" tradeoff the studio's project
model makes for the same reason. A bundled track's id is stable across
sessions, so those entries persist. A local file's id is tied to an object
URL that dies with the tab, so those entries are dead weight after a reload;
`removeTrack`/`clearTracks` actively prune playlists when a track is
actually removed, but a stale id from a closed tab just gets filtered out
next time it's read, never surfaced as an error.

Persisted separately from meta progression, at `survivor616.playlists.v1`
-- this is playback organization, not save-file state, and didn't belong in
`metaStore`'s versioned migration path.
