# Faith Mode in Survivor 616

Optional, free, off by default, never needed for anything in the game. Turn it on in **Settings > Faith (optional) > Christian**.

- **Verse bar:** one line of scripture under the title. Tap it for the verse card (another verse, share, read the chapter, growth bar, verse streak with a weekly grace day).
- **Bouncing Bible:** an opt-in reminder that drifts across the screen every 5 to 60 minutes. It never shows while a run or a minigame is being played (`padGameplayActive()` from `src/lib/consolePad.ts`).
- **Bible reader:** King James Version and World English Bible, book and chapter pickers, bookmarks, private notes, search. Books load one at a time from `public/bible/<kjv|web>/<book>.json` (no offline code cache).

Ported 2026-11-27 from Queens N Kings (`apps/v2/faith`, its docs/183 and docs/184), which is the source of truth for Lokabiblio. Not ported: the Church theme pack, Faith challenges and treasures, the gentle growth notices and the account sync, which depend on Queens N Kings systems. The Bible data files are a copy of Queens N Kings' build output (`scripts/build-bible.mjs` there); rebuild there and copy over.

Progress (`lok.faith.v1`) and settings (`lok.faith.settings.v1`) are their own keys, separate from the game save. Faith text is English for now, like the translations it shows.

Screenshot: `docs/art-library/faith-mode-616.png` (Settings, title verse bar, verse card, reader; headless Chrome at 390x844).
