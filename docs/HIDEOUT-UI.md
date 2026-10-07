# Hideout UI: direction and micro-interaction plan

Starting point for the design discussion. Status: proposal, nothing here is built except the Scene & Sanctum Links fix in 0.19.1.

## What the hideout screen is today

Top to bottom on `HubScreen.tsx`: header and session stats, the walking-operator strip, room navigation grouped by kind with locked rooms dashed, the active room's title card, a collapsible Scene & Sanctum Links panel, then room-specific panels. Rooms and unlocks are data in `data/progression.ts` and `data/hideout.ts`.

## What hurts

1. Dense: every room panel competes at the same visual weight.
2. Copy-pasted controls: links, cards and buttons are rebuilt by hand in each panel, so spacing and states drift (the cause of the broken links panel).
3. The main floor holds seven destinations with no grouping.
4. Feedback is thin: little reaction on press, on reward, or when something new unlocks.
5. Phones get a very long scroll.

## Proposed direction

| Step | Change | Size |
|---|---|---|
| 1 | One shared `LinkCard` component (icon, title, blurb, tone, optional badge). The scene links panel already uses this shape inline | Small |
| 2 | Group the main-floor links: Command (Sector Command, Sanctum computer), Pets (Lit Corner, Dust Mite Rancher, Circuit Frog Ranch), Versus (LokSurvivorArena), Armory | Small |
| 3 | A sticky mini-bar on phones with the three most used destinations | Medium |
| 4 | Split `HubScreen.tsx` into room-panel files so a panel owns its own layout | Medium |
| 5 | First-run tour of rooms, skippable, shown once | Medium |
| 6 | Optional "Classic" hideout layout kept alongside any new one | Required with any redesign |

## Micro-interaction plan

Uses the `microinteractions` skill (Trigger, Rules, Feedback, Loops and Modes). Every item is display-only, respects the device motion setting (`prefersReducedMotion()` in `src/anim/motion.ts`), and runs under 100 ms for the first response.

| Where | Trigger | Feedback to add |
|---|---|---|
| Link cards | Hover, press | Icon lift and arrow nudge on hover (done in 0.19.1), press squash (done), focus ring for keyboard |
| Reward claims | Prop or event payout | Count-up on the currency, a short chip that names the amount and the cap left today |
| Daily cap reached | Payout blocked | Calm "done for today" state, not an error |
| Unlock | A room or item opens | One-time glow on the nav button, cleared after the first visit |
| Collapsible panels | Toggle | Height ease and chevron turn, content kept mounted only while open |
| Currency glossary | Tap the help button | Card slides in; stays tap-first for touch |
| Idle choice event | Walk or idle | Existing "Something's up" chip gets a gentle pulse, never a pop-up |
| Buy and refund | Shop purchase | Price flips to Owned, balance ticks down, undo window for refunds |

Scoring note: the skill rates each interaction on eight rows. Score the five most used ones first and record the failed rows here.

## Rules for any redesign

- Keep the original as a selectable option.
- Reward feedback must read from `hideoutRewards.ts` results, never recompute them.
- No auto pop-ups for optional events.
- Layout must work at 390 px and 1280 px; check both with a screenshot.

## Decisions needed from the owner

1. Group the main-floor links as above, or keep one flat list?
2. Is the phone mini-bar wanted?
3. Which of the micro-interaction rows first?
