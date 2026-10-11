# Lok cost discipline (data + AI usage)

**Why:** we are pre-revenue. Data transfer, hosting calls and AI usage all cost real money, so nothing ships that spends more than it has to. **Every AI working in any Lok repo (Claude, ChatGPT, Copilot, anything else) follows this file.** The ecosystem copy lives in `Lok-EcoSystsem/docs/LOK_COST_DISCIPLINE.md`; keep the two identical.

## Data budget (what the game and sites cost to run)
1. **Procedural art first.** New visuals are SVG/CSS/canvas drawn in code. No new bitmaps, video, audio or web fonts without the owner asking for them. (The LokShop owl, Sleeve ad art, supporter bar and ad slot are all code.)
2. **No new network calls for decoration.** A feature that can be local data (changelog, promo slides, charm sets) stays local.
3. **Fetch rarely, cache hard.** Shared feeds (supporter list, catalog prices) are fetched at most once per 10 minutes per page load and shared between components. Never poll faster.
4. **Pause when unseen.** Timers and animation stop when the tab is hidden, and reduced-motion players get no auto-cycling.
5. **Small payloads.** RPCs return only the fields shown (supporter feed = name, tier, founder).
6. **Lazy by default.** Heavy screens load on demand; do not add to the first-load bundle.

## AI usage rules (what building it costs)
1. **Read before you search.** Start from `CLAUDE.md`, `.agents/memory/MEMORY.md` and the doc for the area. Do not re-derive what is recorded there.
2. **Smallest thing that works.** Use the cheapest model and lowest effort that can do the job; do not spawn subagents or workflows unless the owner asks.
3. **Read once, edit precisely.** Read only the lines you need, never re-read a file you just edited, and batch independent tool calls in one turn.
4. **No speculative work.** No unrequested refactors, generated assets, mass renames or "while I'm here" rewrites. Ask one short question instead of guessing at something large.
5. **Run narrow checks.** Typecheck and the affected tests; run the full suite once before pushing.
6. **No LLM in the loop at runtime.** Game features never call an AI model per player action. Dialogue, greetings, hints and reactions come from authored data and the template generators already in the repo.
7. **Record decisions.** Put what you learned in `.agents/memory/` so the next AI does not pay to rediscover it.

## Checklist for any PR
- [ ] No new binary asset or per-user network call (or the owner approved it)
- [ ] Shared fetches go through the existing cache
- [ ] Animations pause when hidden / reduced motion
- [ ] Nothing here needs an AI call at runtime
