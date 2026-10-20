# LOK Chat (v0.42.0)

Full handoff in `docs/CREW_CHATTER.md` (section "LOK Chat"). Decisions to keep:

- **No model, ever.** Replies are `expandTemplate` + intent matching + live facts, per `docs/LOK_COST_DISCIPLINE.md`.
  Deterministic given an rng, so tests can pin it. Never echo player text in a reply.
- **Device-local, not the meta save.** Threads live in `survivor616.lokchat.v1` (`state/lokChatStore.ts`);
  chatter must never be able to corrupt `normalizeMeta`. `normalizeLokChat` accepts any junk and returns a valid state.
- **Replies are scheduled in `lokChatActions.ts`, not a component**, so a reply still "typing" when you close the
  window arrives unread. `setOpenThread` decides what counts as unread.
- **`useLokChat(selector)` must select a stable slice** (a thread object, the channel array, a number). Selecting a
  freshly built array/object loops `useSyncExternalStore`.
- **One conversation with the strip:** `HubScreen.crewLineFor` logs every crew line to the `#hideout` channel.
- **Every ally needs `CREW_CONFIDES`** (two lines); opinions in `CREW_RELATIONS` are optional.
- Content rules are the crew-talk rules (kid-safe, no profanity, never the banned naming word); the banned-word
  regexp in `lokChat.test.ts` mirrors `crewTalk.test.ts`. `kill`, `hell` and `ass` are on it, so reword rather than allow.
- **Conversation depth (0.42.6):** `ChatThread.conv` (`engine/lokChatTalk.ts` `ConvState`) holds topic, depth, a pending
  question and last person talked about; ids and counts only, never player text. `converse()` in `engine/lokChat.ts`
  order: answer a pending question, then why/more follow-up, then keyword topic (unless a STRONG classic intent),
  then fallback by feeling/shape, else the classic intent templates. Layers unlock by tier (1/2/3). Tests that pin
  exact confide text must not get an appended question (confide never asks one back).
- **Roadmap:** `docs/LOK_CHAT_ROADMAP.md` is the plan for making this a living, dynamic community (phases A-G, decisions
  to confirm, safety rules). Nothing past v0.42.6 is built; free-text player-to-player chat needs an explicit owner decision first.
- Verify: `node --import tsx --test src/game/lokChat.test.ts`, `e2e/lok-chat.spec.ts`; visual check by seeding a save
  with `rescuedAllyIds` and opening `/?screen=hub`.
