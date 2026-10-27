# Shared music catalog

Lok-EcoSystsem/music/catalog.json is authoritative. The shared MP3 player now lives in Lok-EcoSystsem/lok-music; Gsixhub's package is a generated mirror. Run the central scripts/sync-music.mjs to sync. Do not add new authored tracks directly to musicPlayer.tsx. Add the original-game audio asset and register its release centrally, then sync.

Keep public/lok-soundtrack.json compatible (Lokifed only). New clients use https://gsix.online/lok-music-catalog.json plus the bundled catalog snapshot. Data Spark remains first. Existing ids and local files remain valid. Album shelves use release ids to avoid colliding titles across games; legacy shelf ids stay valid.

Forgettable Data: 12 unique uploads (three duplicate copies omitted), no fabricated artist credits, no additional progression gate requested. Original M4A retained; uploaded WAV has an AAC playback copy. See docs/shared-music-2026-10-27.md for rollout and pending automation setup.
