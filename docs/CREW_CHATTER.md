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

## LOK Chat (v0.42.0): the conversational layer

Crew chatter above is one-way (they say a line when you walk up). LOK Chat is the two-way
version: a messenger-style window in the hideout (`ui/LokChat.tsx`, opened from the hub dock) where
you write to any rescued crew member and they answer in their own voice. No model is involved
(`docs/LOK_COST_DISCIPLINE.md`: no LLM at runtime); it is the same template expander plus intent
matching and live game facts, so it is free, works offline and is testable.

| File | Role |
| --- | --- |
| `src/game/engine/lokChat.ts` | Pure rules: `detectIntent` (keyword rules + "who did you mention"), `composeReply` / `replyToIntent`, affinity tiers, `quickReplies`, `chooseProactive`. Seeded, no clock. |
| `src/game/data/lokChatData.ts` | Authored content: intent rules, templates per intent and tone, run lines, proactive lines, `CREW_RELATIONS` (opinions of each other), `CREW_CONFIDES` (two personal lines per ally). |
| `src/game/state/lokChatStore.ts` | Device-local conversations (`survivor616.lokchat.v1`, not the meta save). Pure reducers plus a tiny external store and `useLokChat(selector)`. |
| `src/game/state/lokChatActions.ts` | Sending, delivering a reply after a typing pause, crew starting conversations, logging strip chatter to `#hideout`. |
| `src/ui/LokChat.tsx` | Launcher (with unread badge) and the overlay. List and conversation take turns on a phone. |
| `src/game/lokChat.test.ts`, `e2e/lok-chat.spec.ts` | Rules, store, actions; browser flows. |

Behavior worth knowing:

- **Intents:** greet, howAreYou, work, room, crew (about another ally), run, pet, weather, advice, joke,
  story (their existing voice topics), confide, thanks, bye, unknown. A mention of another crew member
  wins unless the message is clearly a thanks, goodbye, joke, run/pet/weather question or a confidence.
- **Facts used:** the speaker's room and who is with them, weather, local hour, last run (area and
  outcome), the lead LokPet's name, tone (the Family/Wry crew-talk setting) and relationship tier.
- **Relationship:** affinity points per person (`new` < 12 <= `friend` < 40 <= `close`). New topics earn
  more than repeats; nonsense earns nothing. Friends unlock "Tell me something real" (`CREW_CONFIDES`).
- **Safety:** replies never echo what the player typed. The banned-word test scans every authored string
  and every rendered reply (all allies, intents, tones, many seeds). Extend the list rather than loosening it.
- **They write first:** after a finished run (once per run), after three days of silence, and good morning /
  good evening to friends, at most one such message per person every six hours.
- **#hideout channel:** every line `crewLineFor` produces (taps and strip chatter) is logged
  (`logCrewLine`), so the strip and the chat stay one conversation.

### Conversation depth (v0.42.6)

Replies are no longer one-shot. `engine/lokChatTalk.ts` reads what a message is *like* (a feeling, a question,
"why", "more", yes / no / not sure, "what about her?") and `ChatThread.conv` (saved per person: current topic and
depth, a pending question, how deep each topic went, last person discussed) carries the conversation forward.
Only ids and counts are saved, never what the player typed.

- **Topics with layers** (`data/lokChatTopics.ts`): shared topics (city, food, music, fear, enemies, gear, sleep,
  friends, dreams, the past) plus a few per ally (`ALLY_TOPICS`). Layer 1 is for anyone, layer 2 opens at *friend*,
  layer 3 at *close*; "why" / "tell me more" / asking again goes one layer deeper, a stranger is told it is for
  later. Single-layer topics are reactions (compliment, teasing, sorry, "are you real").
- **They ask back** (`QUESTIONS`): about 30% of replies end with a question; the next short answer (yes / no / not
  sure / a feeling / anything) gets an in-voice reaction. They also offer a topic ("Want to hear about the shop?")
  and take a yes. "Want me to go on?" after a layer works the same way.
- **No dead ends:** unrecognized text is answered by shape, a feeling line, small talk, an honest "I don't know",
  then an offer. Memory callbacks (last area, last topic) appear in friend greetings.
- **Feel:** long replies sometimes arrive as two bubbles; typing pace follows the ally's temperament; quick replies
  switch to Yes / Not really / Not sure while a question waits, and "Tell me more" while a topic has layers left.

Adding a topic: a `TopicDef` in `ALLY_TOPICS` (3 layers) or `SHARED_TOPICS`; allies without one fall back to a
ladder built from their voice, so nobody is empty. Open: ally-to-ally lines in #hideout, reaction taps.

Adding to it: a new ally needs a `CREW_CONFIDES` entry (the test fails otherwise); opinions about other
crew are optional (a role-based line is the fallback). A new intent is a row in `INTENT_RULES`, a
template set in `INTENT_TEMPLATES` (or a branch in `oneReply`), and a quick reply in `quickReplies`.
Open ideas: per-ally intent overrides, group chats, remembering what you asked for callbacks, run-specific
details (best weapon, area records), localized fragments.
