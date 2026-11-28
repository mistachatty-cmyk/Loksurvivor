# LOK Chat plugin (`@lok/chat`)

LOK Chat is the two-way conversation layer that lets people in a LOK app talk back: a messenger, crew that follow a
thought, topics with depth, feelings, questions back, and (planned) crew who talk to each other and a living
community. It lives in `packages/lok-chat` with zero game imports so it can move to its own repo and be used by
**every app in the LOK ecosystem**. 616 Survivor is the first consumer. Roadmap: `docs/LOK_CHAT_ROADMAP.md`.

## Principles
- **No model at runtime, ever** (`docs/LOK_COST_DISCIPLINE.md`). Replies are authored content + keyword matching +
  live facts the app supplies. Free, offline, deterministic given an rng, fully testable.
- **Player text is matched, never stored or echoed.** Saved state is ids and counts (`ConvState`).
- **Every feature is switchable** (manifest flag AND player setting). Off generates nothing, stores nothing, shows nothing.
- Kid-safe, never the banned naming word; `validateCast` enforces it for every app's cast.

## What an app supplies: the cast
A `ChatCast` (see `src/types.ts`): `voices`, `confides`, `relations`, intent rules and templates, shared topics and
per-person topics (3 layers each), questions they ask back, feeling and small-talk lines, proactive and run lines.
`examples/minimal-cast/cast.ts` is the smallest valid one. 616's is assembled in
`artifacts/survivor-616/src/game/chat/cast.ts` from `data/lokChat*.ts` and `data/crewVoices.ts`.
The app also gives a `buildContext(personId, affinity)` returning live facts (place, weather, hour, last session, companion
name, tone) and UI strings of its own.

## Runtime
```ts
createChatEngine(cast, { features })    // detectIntent, replyToIntent, composeReply, proactiveLine
createChatStore({ key })                // get/update/subscribe/clear + useChat(selector)
createChatActions({ engine, store, features, pace })   // sendToAlly, startProactive, deliver, logCrewLine, setOpenThread
validateCast(cast)  ·  runTranscript(engine, self, others, opts)  ·  CHAT_FEATURES / mergeFeatures
```
616 binds these once in `src/game/chat/runtime.ts`; `engine/lokChat.ts`, `state/lokChatStore.ts` and
`state/lokChatActions.ts` are thin re-exports that keep the old import paths. The React overlay (`ui/LokChat.tsx`) is
still 616's own reference implementation; moving it into the package behind a strings object and theme tokens is
tracked in the roadmap.

## Feature switches
`lok.universe.json`: `"lokChat": { "enabled": true, "source": "616_survivor", "features": { "scenes": false } }`.
Effective switch = manifest AND the player's device-local choice (Settings > LOK Chat, default on).
`chat` is the master switch for the messenger and everything built on it; `strip` (one-way hideout lines) stands alone.

| Feature | What it controls |
| --- | --- |
| `chat` | the messenger and its launcher |
| `depth` | topics, follow-ups, feelings, replies to how you feel |
| `questionsBack` | crew ask you a question and react to the answer |
| `twoBubbles` | long replies sometimes arrive as two messages |
| `proactive` | crew write first (after a run, after a long absence, morning and evening) |
| `memory` | callbacks to your last session or topic |
| `strip` | one-way crew lines in the hideout |
| `scenes` | crew-to-crew scenes written into `#hideout` once a day (`pickScenes`, seeded by the day; opinion scenes come free from `relations`) |
| `group` | you can talk in `#hideout`; one to three people answer a beat apart (`sendToGroup`) |
| `moods` | a mood per person per day (`moodOf`) colours their words and greetings |
| `presence` / `reactions` | planned (roadmap phases C-D); the switches exist now |

The manifest schema lives in the vendored SDK: `Lok-EcoSystsem/universe-sdk` needs the matching `lokChat` entry
(never edit `lib/lok-universe` here).

## Crew-to-crew, moods and memory (feature notes)
- **Scenes** (`SceneDef`): `between: [a, b]` fixes the pair, `when` limits weather / time of day / after-run outcome;
  `<a>`, `<b>`, `<c>` fill in names (address people by name, never pronouns). `runScenes` plays 1-3 once per local day and
  remembers which ran lately (no repeats for 24 plays). Every `relations[a][b]` opinion becomes a two-line scene for free
  (`sceneReplies` answer when b has no authored opinion of a).
- **Group chat**: replies are one-shot (no questions back, no saved state); the player's own line is logged as `me`.
- **Moods**: five ids (`bright, steady, tired, restless, wistful`); `moodWords` replace the `<mood>` slot and `moodOpeners` start some greetings.
- **Memory**: `recordEvent` logs `cleared`/`fell`/`rescued`/`pet` once by key (cap 40); a friend's greeting may bring an unused one
  up via `eventCallbacks` and marks it used. Only area/person names are stored.
- **Strip chatter**: 616's `engine/crewSpeak.ts` mixes weather- and time-aware lines (`data/crewStripLines.ts`) into the one-way hideout lines when the `strip` switch is on.

## Onboarding a new app
1. Add `@lok/chat` as a workspace dependency.
2. Copy `examples/minimal-cast/cast.ts`, write your people, and run `validateCast` in your tests.
3. Provide `buildContext` (the facts) and your UI strings; create the engine, store and actions once (see 616's `runtime.ts`).
4. Mount a launcher and conversation UI (616's `ui/LokChat.tsx` is the reference).
5. Add the `lokChat` manifest block and a Settings section that lists the features (`ui/LokChatSettings.tsx`).
6. Add transcript tests with `runTranscript` and hold the fallback rate (616: <= 20% per run, < 8% average).

## Quality gates (616's `lokChat.test.ts`)
`validateCast(SURVIVOR_CAST)` clean; every ally has 2+ personal topics of 3 layers; transcripts for every ally x tone x
closeness keep fallback <= 20% (average < 8%), repeats <= 7%, replies under 480 characters, no banned words; close friends
reach layer 3 while strangers stay on layer 1. The package's own tests prove a non-616 cast works and every toggle turns
its behaviour off.
