# @lok/chat (LOK Chat)

A game-agnostic conversation engine for crew, companions and community: follow-ups, topics that open up as people
get close, feelings, questions back, proactive messages, two-bubble replies. **Replies are authored and
deterministic, there is no model at runtime, and every feature can be switched off.** A LOK Ecosystem plugin, built
to be lifted into its own repo. Product spec and per-app onboarding: `docs/LOK_CHAT.md`.

```ts
const engine = createChatEngine(myCast, { features: () => flags });   // rules bound to your cast
const store = createChatStore({ key: 'myapp.lokchat.v1' });          // device-local threads + React hook
const actions = createChatActions({ engine, store, features: () => flags });
```

- `examples/minimal-cast` is a three-person cast that passes `validateCast`; copy it to start.
- `validateCast(cast)` is the safety gate (banned words, markup, slots, confidences, topics).
- `runTranscript(engine, ...)` measures a scripted chat (fallback rate, repeats, depth reached).
- `pnpm test` runs the suite.
