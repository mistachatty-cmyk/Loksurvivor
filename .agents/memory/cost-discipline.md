# Cost discipline (data + AI usage)

Pre-revenue: every byte and every AI call costs real money. Full rules in `docs/LOK_COST_DISCIPLINE.md` (mirrored in Lok-EcoSystsem/docs). Short form: procedural SVG/CSS art only, no new network calls for decoration, shared feeds fetched at most every 10 minutes and cached, animation pauses when hidden or reduced-motion, no per-action LLM calls in the game, and when building: read docs/memory first, cheapest model that works, no subagent fan-out unless asked, batch tool calls, narrow checks.

The hub ad slot (`LokPromoCycle`, `data/promoSlides.ts`) is the reference example: all local data, procedural art, post new items by adding a row to `PINNED_PROMOS` (newest changelog entries are posted automatically).
