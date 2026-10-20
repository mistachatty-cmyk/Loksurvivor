# LOK Chat: system reference and roadmap to a living community

Status: **planning document, nothing in the roadmap below is built yet** (sections 1-3 describe what exists as of
v0.42.6). Written so any later session can pick a phase up cold. Read `docs/LOK_COST_DISCIPLINE.md` first; every
phase obeys it.

## 1. What exists today (v0.42.6)

LOK Chat is a messenger in the hideout (hub dock button -> `ui/LokChat.tsx`). You write to any rescued crew
member and they answer in their own voice. There is **no model at runtime**: everything is authored content,
keyword matching and live game facts, deterministic given an rng, free and offline.

| Layer | File | Job |
| --- | --- | --- |
| Rules | `src/game/engine/lokChat.ts` | `detectIntent`, `replyToIntent` (`converse()`), affinity tiers, `quickReplies`, `splitReply`, proactive messages |
| Conversation reading | `src/game/engine/lokChatTalk.ts` | `analyze` (question, feeling, follow-up kind), `ConvState` |
| Authored content | `src/game/data/lokChatData.ts` | intent rules/templates, run lines, proactive lines, `CREW_CONFIDES`, `CREW_RELATIONS` |
| Deeper content | `src/game/data/lokChatTopics.ts` | layered topics (shared + per ally), questions they ask back, feeling and small-talk lines |
| Voices | `src/game/data/crewVoices.ts`, `engine/crewTalk.ts` | template expander (`{a|b}`, `<slot>`), per-ally openers/topics/own pools |
| State | `src/game/state/lokChatStore.ts` | device-local threads (`survivor616.lokchat.v1`), pure reducers, `normalizeLokChat` |
| Glue | `src/game/state/lokChatActions.ts` | send, typing delay, two-bubble delivery, proactive messages, `#hideout` log |
| UI | `src/ui/LokChat.tsx` | launcher with unread badge, list/thread, quick replies |

### How one message flows
1. UI calls `sendToAlly` with the text (or a quick reply). Context = hub facts (room, weather, hour, last run, pet,
   tone, affinity) + the thread's saved `conv`.
2. `detectIntent` -> classic intent (greet, work, run...) + `analysis` (feeling, question, follow-up kind).
3. `converse()` picks, in order: answer to a **pending question** -> **why/more** follow-up on the current topic ->
   **keyword topic** (unless a strong classic intent like bye/thanks/joke/run/pet/weather/confide) -> **fallback by
   shape** (feeling, laugh/ack, question, statement, then offers a topic) -> classic intent template. Then, sometimes,
   appends a question back (never after confide/bye/thanks/small talk).
4. Result carries the new `ConvState` (topic + depth, pending id, per-topic depths, last 6 questions, last person
   discussed, last topic label). Only ids and counts are saved. A reply never echoes the player's words.
5. `splitReply` may deliver it as two bubbles; typing delay follows the ally's temperament.

### Relationship model
Affinity points per person: `new` (<12) / `friend` (<40) / `close`. New topics earn more than repeats; follow-ups
earn steadily; nonsense earns nothing. Tier gates topic layers (1/2/3) and confidences.

### Hard rules (carry into every phase)
- No LLM, no network, no per-message cost at runtime. Cost discipline doc is binding.
- Player text is matched, never stored or echoed. (Anything stored must be an id, count or a pick from a fixed list.)
- Kid-safe, no profanity, never the word "signal" (use beacon, pulse, relay, static, frequency). `lokChat.test.ts`
  scans every authored string and many rendered replies; extend the scan with every new content file.
- Device-local first. Chat state never touches `normalizeMeta`; payouts go through `engine/hideoutRewards.ts`.
- Deterministic given an rng, so every behaviour is testable.
- Content is authored English today (like `lokChatData.ts`); see Phase G for localization.

## 2. Gaps (why it does not yet feel alive)
1. Only 10 of 20 allies have personal topics; the rest use a ladder built from their voice lines.
2. The crew only talk to the player. They do not talk to each other, remember shared events, or change with the day.
3. Presence is fake: nothing happens while you are away except a few proactive lines; no schedules, moods or "last seen".
4. The player can only type or tap suggestions. No reactions, no choices that matter, no consequences.
5. Matching is regexes. Paraphrases, typos and compound messages are weak.
6. No player-to-player layer at all.
7. No tooling to see where conversations break (fallback rate, repeats, coverage).

## 3. Success looks like
- A player can open the chat on three different days and find things that are different and make sense for that day.
- At least a quarter of chat time is the crew talking to each other or reacting to the world, not to the player.
- Fallback ("I don't know") under 10% of typed messages in scripted transcripts; repeat lines under 2% per 100 messages.
- Players can leave a trace on the world (a message, a choice, a nickname) that another session or player can see,
  without any free-text moderation risk.
- Monthly running cost of the whole system stays ~zero until there is revenue (Phase F is opt-in and gated).

## 4. Roadmap

Order is by value for effort and by dependency. Each phase is shippable on its own, bumps the changelog, and ends with
tests plus a docs/memory update.

### Phase A: finish the people (content, small code)
- Author 2-3 topics x 3 layers for the remaining ten allies (Bulbosa, Ruth, Frankie, Constance, Theo, Otis, Sarge,
  Patch, Mara, Latch) and a second topic for those who have one. Include each person's *refusals* and *quirks*.
- Per-ally **style**: sentence length, favourite words, punctuation habits, emoji-free signature tics, how they type
  (Pippa fast and lowercase, Constance formal). Implement as a `ChatStyle` record applied after expansion.
- Per-ally intent overrides (a custom answer to "how are you" that beats the shared template) and signature keywords.
- Two or three alternative layer texts per layer so the same chat on a second playthrough differs.
- Coverage test: every ally has >= 3 topics x 3 layers, every topic has a hook label, no two layers identical.
- Size: ~250 authored lines. Risk: voice drift; review against `CREW_CONFIDES` and `crewVoices.ts`.

### Phase B: the hideout talks to itself (the biggest "alive" step)
- **Crew-to-crew conversations** in `#hideout`: small dialogue scripts (3-6 lines, two or three speakers) chosen from
  `CREW_RELATIONS`-driven pools and triggered by shared facts (same room, weather, time of day, a recent run,
  someone's birthday-of-rescue). Seeded by the calendar day so they are stable per device per day. The player can
  read, react, or jump in (their message joins the group thread).
- **Group chat**: `#hideout` becomes a real thread with participants; replies from several people to one message
  (first responder fast, others after, with disagreement and interruption).
- **Daily mood** per ally (derived from day seed + events, never stored free text): tired, hopeful, restless...
  It colours greetings, fallback lines and how much they open up; some days a topic layer is "not today".
- **Shared memory log**: a small capped list of structured events (cleared Back Alley, lost a run, found a pet,
  rescued X, reached a tier with Y). Crew reference it ("You and Mara were out there all night"), with each
  event usable at most N times to avoid nagging.
- **Gossip and rumours**: the existing crew rumour system (`docs/CREW_CHATTER.md`) feeds `#hideout`; someone tells
  you something, someone else disputes it.
- **Relationship drift between crew**: pair affinity changes with what the player does (who they take out, who they
  feed) and changes the lines they say about each other.
- Needs: `data/lokChatScenes.ts` (scripts), `engine/lokChatScenes.ts` (selection + scheduling), store additions for
  last-scene ids and the event log, tests that every scene renders clean across seeds and tones.

### Phase C: time and presence
- **Schedules**: each ally has hours (asleep, working, free) from room + temperament. "Last seen" and status in
  the list; messages to someone asleep are answered when they wake (computed from elapsed real time on open, not
  timers), with sleepy or "later" replies.
- **While you were away**: on return, build a digest from elapsed time (a few unread messages, a crew-to-crew
  thread, a mood change), not a timer queue. Cap by hours away so a month away does not flood.
- **Rituals**: morning / evening check-ins, weekly "kitchen night", streak-friendly callbacks that never punish a
  missed day.
- **Typing realism**: read receipts, "seen" delays tied to status, occasional unfinished thought.
- Needs `engine/lokChatPresence.ts` (pure: schedule + elapsed -> status/digest), store fields for last-open time.

### Phase D: the player has a voice
- **Reactions and stickers**: tap-to-react on any bubble (heart, laugh, salute, hug) from a fixed set; crew react to
  *your* messages too. Procedural SVG stickers only (no assets).
- **Choices**: some messages offer 2-3 reply buttons that change a relationship, unlock a layer, or start a
  mini-story. Story threads are authored graphs (`data/lokChatStories.ts`) with explicit state ids.
- **Quest by message**: a crew member asks for a favour (bring a pet, clear an area, find an item); completion
  pays through `engine/hideoutRewards.ts` with its daily caps. No new currency.
- **Nicknames and pronouns**: picked from fixed lists, remembered per ally, used in lines. (No free text stored.)
- **Better understanding**: synonym tables, simple stemming and typo tolerance (edit distance 1 on keywords),
  multi-intent messages, negation ("not tired"), then measure fallback rate with the Phase G tooling.

### Phase E: community (real players), safety first
Principle: **no free-text player-to-player messages** until a moderation pipeline exists. Everything below uses
fixed phrases, emotes, structured cards and cached shared feeds.
- **World feed**: one shared, cached daily payload (per cost discipline: one cached read for all players) with
  - the city rumour of the day, the crew's reaction, and a global event ("The Cellar floods tonight");
  - aggregate stats ("412 survivors cleared Monroe Strip today").
  Served from the existing LOK/Supabase stack as a single static JSON, like `lok-updates.json`.
- **Postcards**: send another player (friend code or LOK account friend) a card from a fixed set: a stat card, an
  emote, a pick from ~40 approved phrases with crew-voiced flavour. Inbox is a thread in LOK Chat from "the mail".
- **Visit cards**: show another player's hideout crew roster and one crew line in a read-only view.
- **Shared quests**: weekly community goal with a progress bar everyone adds to; crew comment on progress.
- **Safety**: report/block on every inbound item, rate limits, server-side phrase allowlist, kid-safe defaults,
  age-appropriate account rules from the LOK ecosystem (see `Lok-EcoSystsem/LokToken EcoSystem/LOK_PLATFORMS.md`),
  logs retained minimally. Anything with free text is a separate decision gate (Section 6).
- **Where it lives**: `lib/lok-client` for transport, tables in the shared Supabase project, display in LOK Chat as
  new "channels" (World, Mail). Mirrored on gsix.online later via the hub.
- Needs a threat model document before any code.

### Phase F: optional smarter replies (decision gate, not a commitment)
Only if Phases A-D still leave conversations feeling scripted and there is revenue to carry it.
- Options: (1) a small on-device model behind an opt-in toggle, output filtered through the same banned-word and
  length checks and never fed raw player text to a server; (2) a hosted model through a metered LOK service, off by
  default, per-day cap, server-side safety, cost shown to the owner; (3) more authoring tools instead (cheapest).
- The seam is `replyToIntent`: a provider interface that must return text + `ConvState`, and must pass the same
  safety filter. Everything else stays authored.
- Evaluate with the Phase G transcript harness before deciding.

### Phase G: tooling and quality (do early, alongside A and B)
- **Transcript harness**: scripted chats per ally/tone/tier run in tests; report fallback rate, repeats, unused topics,
  longest reply, and layers never reachable. A dev-only panel in Settings can replay a transcript.
- **Content linter**: unresolved markup, banned words, duplicate lines, overlong lines, topic without hook label.
- **Authoring format**: move topics and scenes to JSON/TS records with a schema so non-engineers can add content.
- **Localization**: today chat content is English-only. Options: translate authored files through the auto-l10n
  pipeline by moving strings to `en.json` keys (large), or ship chat in English with localized UI. Decide before
  Phase E, because world-feed cards will be user-visible in every language.
- **Metrics without spying**: no telemetry of what players type. Local-only counters (fallback rate) exposed in a dev
  panel; optional aggregate counts if the owner turns on analytics.

## 5. Suggested order and size
| Step | Phases | Rough size | Why first |
| --- | --- | --- | --- |
| 1 | G (harness + linter) and A | 1-2 sessions | Measure, then fill the thinnest allies |
| 2 | B (scenes, group chat, mood, memory log) | 3-4 sessions | The jump from "bot" to "place" |
| 3 | C (presence, digest) | 1-2 sessions | Makes the world move while away |
| 4 | D (reactions, choices, quests, understanding) | 3 sessions | Player agency |
| 5 | E (world feed, postcards, visits) | 4+ sessions, threat model first | Community |
| 6 | F | decision only | Revisit with data |

## 6. Decisions to make before building
1. Free text between players: never, allowlist-only, or moderated? (Default: allowlist-only.)
2. Chat localization strategy (Phase G).
3. Whether crew-to-crew scenes pay the player anything (default: no, only reading them is the reward).
4. Where world-feed data is hosted and who curates the daily rumour (default: authored pool + seeded by date).
5. Whether presence/schedules may gate content (default: never block, only colour).
6. Age and safety rules for any shared surface (owner + LOK platform guide).

## 7. Risks
- Content volume and voice drift: mitigate with the linter, review against `crewVoices.ts`, and per-ally style records.
- Repetition fatigue: scene pools need variety multipliers (day seed, mood, tier) and a no-repeat window.
- Save growth: cap every list (event log 40, scene ids 30, messages 80/thread); `normalizeLokChat` must keep
  tolerating old saves and junk.
- Safety creep: any feature that stores or relays player words needs the Section 6 decision first.
- Cost creep: no feature may call a paid API per message; shared feeds are single cached reads.

## 8. Definition of done for each phase
Pure logic in `engine/`, authored content in `data/`, state in `state/`, tests in `lokChat.test.ts` or a sibling
(banned-word scan extended to new files), e2e extended in `e2e/lok-chat.spec.ts`, `typecheck` + `pnpm test` green,
CHANGELOG bumped and `public/lok-updates.json` re-exported, this file and `docs/CREW_CHATTER.md` updated, and
`.agents/memory/lok-chat.md` given the new durable decisions.
