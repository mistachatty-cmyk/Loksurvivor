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
- Verify: `node --import tsx --test src/game/lokChat.test.ts`, `e2e/lok-chat.spec.ts`; visual check by seeding a save
  with `rescuedAllyIds` and opening `/?screen=hub`.
