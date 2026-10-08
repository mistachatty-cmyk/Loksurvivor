# Crew Chatter — handoff (v0.19.8 → v0.19.9)

Procedural, per-character dialogue for rescued crew standing in hideout rooms.
Inspired by [rant-lang/rant](https://github.com/rant-lang/rant) (Rant 4 alpha,
Rust). We borrowed its ideas, not its code. Earlier design note:
`.agents/memory/crew-dialogue-rant.md`.

## What shipped

1. **Crew stand in their rooms.** `HubScreen.tsx` adds each rescued ally whose
   `AllyDef.room` matches the active room as an `art: 'npc'` strip prop with id
   `ally:<allyId>` (drawn with `allyRig`). Before this only the Luvitnot Keeper
   (GRPD station) stood anywhere. Walk up, interact, `handlePropUse` handles the
   `ally:` prefix.
2. **Fresh line each interaction** from a seeded template expander.
3. **Settings → Hideout** (all device-local `localStorage`, not in the save):
   - *Note duration* 6 / 12 / 20 / 30 s (`state/hideoutNoticeSetting.ts`; the
     corner toast in `HideoutPreview.tsx` reads `hideoutNoticeMs()`; unset keeps
     the old 6.5 s).
   - *Crew chatter* Fresh lines / Intro only (`state/crewTalkSetting.ts`).
   - *Crew tone* Family / Wry (shown only with Fresh lines).

## Files

| File | Role |
| --- | --- |
| `src/game/engine/crewTalk.ts` | Template expander + `generateCrewLine`. Pure, seeded (`createRng`). |
| `src/game/engine/crewSpeak.ts` | Builds the context (weather words, room name, other crew names, tone) and picks the voice. |
| `src/game/data/crewVoices.ts` | `SHARED_POOLS` and one `CrewVoice` record per ally id, plus `FALLBACK_VOICE`. |
| `src/game/state/crewTalkSetting.ts` | Mode and tone settings. |
| `src/game/state/hideoutNoticeSetting.ts` | Note duration setting. |
| `src/game/crewTalk.test.ts` | Expander, voice coverage, determinism/variety, banned words. |
| `src/ui/HubScreen.tsx` | Crew props, `handlePropUse` `ally:` branch, per-ally recent-lines ref (last 12). |
| `src/ui/SettingsPanel.tsx` | `CrewTalkSetting` and the note-duration buttons. |

## Template syntax

```
{a|b|c}      random branch (nestable, empty branch allowed: {a|})
{3*a|b}      weighted branch
<slot>       pool fill: food hazard place sound thing mood time advice
             + context: crew room weather + per-voice: own
```

A normal line is `opener + topic + {2*| closer}`; in Wry tone 40% of lines are a
whole `wry` template instead. Output is whitespace-normalized and
sentence-capitalized (`tidy`).

## Rules for content (enforced by the test)

Wry and grown-up is welcome; it must still be fine if a child reads it. No
profanity, sexual content, gore, drug/alcohol punchlines, real-world politics or
fake real-person claims. Never the word "signal" (CLAUDE.md naming rule): use
beacon, pulse, relay, static, frequency. The test scans both source and rendered
output (150 seeds × 2 tones × every ally) against a banned list; extend that list
rather than loosening it. Adding a banned word that appears in valid text means
rewording the text.

## How to add or change things

- **New ally voice:** add a record under the ally's id in `CREW_VOICES`
  (`openers`, `topics`, `closers`, `wry`, `own`). The test fails if an `ALLIES`
  entry has no voice.
- **New pool/slot:** add to `SHARED_POOLS`, or to `pools` in `crewSpeak.ts` if it
  depends on game state.
- **More variety:** add openers/topics/closers; volume is roughly multiplicative.

## Where it could expand

Ordered roughly by value for effort.

1. **User's special directions and communications.** Reserved, nothing invented.
   Suggested shape: an optional `special?: SpecialLine[]` on `CrewVoice`, each
   with a gate (ally rescued, room, flag, day, run result) and a priority that
   overrides random generation. Needs the user's content first.
2. **Run-aware mood.** `lastRun` (win/loss, kills, area cleared) is already in
   `useMeta()`. Add a `mood`/`justBack` pool so crew react to the last run, and
   a "welcome back after N days" line.
3. **Time and season.** Real hour is easy (`new Date()`); a `time` pool is
   currently generic. Tie it to the hideout day/night weather scenes in
   `data/hideout.ts` for consistent text.
4. **Crew-to-crew talk.** `<crew>` only names a random other ally. A pair table
   (`vee`+`mamajo` friction, `nyx`+`morrow` rooftop banter) could drive two-line
   exchanges or lines that depend on who shares the room.
5. **Memory and callbacks.** Persist a tiny per-ally seen-set (meta) so rare
   lines fire once and later lines can refer back. Currently recent lines are
   session-only (a ref in `HubScreen`).
6. **Pets and relics.** Reference the equipped LokPet name, bond rank, or recent
   discoveries. `petCallName` and `DISCOVERIES` already exist.
7. **Localization.** Fragments are inline English like ally blurbs, so the
   auto-translate action does not touch them (only the settings labels are in
   `en.json`). Realistic options: per-locale voice files, or leave English-only
   and say so in the UI. Slot grammar ("a/an", plurals) will need care.
8. **Bubbles instead of corner toasts.** Draw a speech bubble over the NPC on the
   strip (`HideoutPreview.tsx`), reusing `drawRig`'s facing/position data.
9. **Other NPCs.** The Keeper, Jeremey and Jeramy (`data/npcCast.ts`) still use
   fixed prop lines (`hideoutProps.ts`, `lineKeys`). They can get `CrewVoice`
   records and share the same path.
10. **Voice/typing sound.** Optional blip per character.
11. **Rust Rant / WASM.** Only if the TS expander outgrows its needs (loops,
    functions, modules). Rant is alpha, so avoid until stable.

## Known gaps / things to check

- Not playtested in the browser; check bubble overlap when several crew share one
  room (x positions are evenly spread between 0.2 and 0.8 of the walk range).
- Crew props are rebuilt when `rescuedAllies` changes (see `hideoutPropInfos`
  memo). Any parent re-render that changes its identity would churn them.
- Wry/Family differ only in the 40% wry template share; Family has no templates of
  its own beyond the shared ones. A true tone split would add `family` arrays.
- Slot repetition in a single line is possible (two `<crew>` fills can pick the
  same name). Harmless, but visible if it happens.
- `Math.random` is used at the call site for real play; tests use `createRng`.
- Four of the 20 voices (the Rapid Shelter trio and a few others) are shorter than
  the first nine and are the first place to deepen.
- Changelog: v0.19.8 (note duration + crew in rooms), v0.19.9 (crew chatter).
  `public/lok-updates.json` is regenerated with
  `pnpm exec tsx scripts/export-public-updates.ts public/lok-updates.json`.

## Handoff checklist for the next person

- [ ] Get the user's special directions/communications and decide the `special`
      schema before writing any special lines.
- [ ] Playtest each room with crew present, in both tones and both modes.
- [ ] Deepen thin voices (denny, ruth, frankie, constance, theo, otis, archivist,
      sarge, patch-mercer, mara-vance, latch-brooks).
- [ ] Run `pnpm typecheck` and `pnpm test` from `artifacts/survivor-616/`.
- [ ] Bump `CHANGELOG`, re-export public updates, keep the banned-word test.
