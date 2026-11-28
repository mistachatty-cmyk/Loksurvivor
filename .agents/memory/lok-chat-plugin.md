# LOK Chat as an ecosystem plugin (`packages/lok-chat`)

- The engine, store and actions are game-agnostic in `@lok/chat`; 616 supplies a `ChatCast` (`src/game/chat/cast.ts`)
  and binds a runtime in `src/game/chat/runtime.ts`. `engine/lokChat.ts`, `state/lokChatStore.ts`, `state/lokChatActions.ts`
  are thin re-exports so old imports keep working. Do not put 616 imports in the package.
- Cast-dependent rules live inside `createChatEngine(cast)`; pure helpers (affinity, quickReplies, splitReply...) are top-level.
- Every feature has a switch: manifest `lokChat.features` AND the player's setting (`src/lib/lokChatSetting.ts`, Settings > LOK Chat).
  `chat:false` gates the messenger and everything on it; `strip` stands alone. A new feature = add to `ChatFeature`,
  `CHAT_FEATURES`, the Settings strings in `en.json` (`lokChat.settings.feature.<key>.*`) and a test that off means nothing happens.
- New content must pass `validateCast` and the transcript gates in `lokChat.test.ts`; add personal topics in
  `data/lokChatTopics.ts` / `data/lokChatTopicsCrew.ts` (3 layers each).
- v0.42.8: scenes (`pickScenes`/`runScenes`, once per local day), group `#hideout` (`sendToGroup`), moods (`moodOf`), event log (`recordEvent`, callbacks), strip lines. Scenes use names only (no pronouns). Group replies are one-shot (`ctx.oneShot`).
- Open: move the React overlay into the package (strings + theme tokens), scenes/group/moods/memory log (roadmap phase B),
  presence, reactions, then the community gate. The vendored SDK manifest schema needs a `lokChat` entry.
- Docs: `docs/LOK_CHAT.md` (spec + onboarding), `docs/LOK_CHAT_ROADMAP.md` (plan).
