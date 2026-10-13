# Training Arena next-pass spec (2026-10-13)

## Status

- **Owner:** User for design review; implementation not started.
- **Goal:** Capture the reviewed next-pass requirements, integration points, and remaining decisions for the Training Arena.
- **Scope:** LokShop access, per-weapon progression, persistent notifications, training stats and target options, operator XP, multi-weapon testing, and a timed damage challenge.
- **Current baseline:** Training Arena is on `main` after PRs #273, #274, #275, and #276. The current arena has a dedicated stationary test scene, Dust Mite target, weapon dock, and in-screen controls. See [the original handoff](training-arena-handoff-2026-10-13.md).
- **This change:** Documentation only. It does not implement the next-pass systems.
- **Next:** Review the open decisions below, then build the approved system in small connected steps and visually check each flow.

## Reviewed requirements

### Arena layout and controls

- Keep a dedicated Training Arena scene with the operator and Dust Mite facing one another. Neither actor moves in this phase.
- Keep the arena as the main scene with controls and readouts placed over it. The arena should not sit partway down a page with the browser/page scrollbar moving the whole experience.
- Keep the weapon rack in a fixed left-side dock. Only the rack list scrolls; the arena and its HUD stay fixed in the viewport. The player can select a weapon directly from the rack.
- Provide a clear **Base / Level** view toggle for the selected weapon. The exact meaning of “Level” still needs confirmation (weapon upgrade level, operator level, or both).
- Add a compact stats panel that updates while an attack is running and after it settles. At minimum, show total damage, damage per second, hit count, critical hits, and the selected weapon's base/level context.
- Useful additions for that panel: largest hit, average hit, critical-hit rate, attack rate, and each status effect's damage or active time when measurable. Keep those secondary so the main damage readout remains easy to scan.
- Show the operator's level and XP progress bar along the top edge of the arena.
- Show the effects produced by the selected attack in a readable event/effect area: direct damage, criticals, status effects, delayed hits, and notable secondary effects. Do not require players to infer effects from animation alone.
- Preserve target durability choices and add **Non-lethal** and **Infinite HP** target modes. In either mode, damage accounting must continue without stopping the attack preview when the target would otherwise be defeated.

### Access and progression

- Sell permanent **Weapon Rack** access in LokShop. The price/currency tier is not decided yet; do not invent a price in implementation.
- After buying the rack, each weapon remains unavailable for arena use until the player earns **616 kills with that weapon**. Show per-weapon progress as `current / 616`, including locked rack entries.
- A run's kills do not advance the permanent counter until that run has ended and its result is committed. Abandoned/unfinished runs must not grant progress. Training Arena kills never count toward the run-kill gate.
- When a weapon reaches 616, queue an unlock notification that includes that weapon's icon.
- Unlock **Multi-Weapon Testing** after doing **1,000,000 total damage to the training dummy**. Whether this is cumulative across arena visits or must happen in one visit is an open decision. Each weapon must still satisfy its own 616-kill gate before it can be selected in a multi-weapon setup.
- Award operator XP for attacks in the arena: `0.1 XP` per attack and `0.3 XP` for a critical attack. The intended interpretation is that a critical hit receives 0.3 total XP in place of 0.1, but this needs confirmation. The operator XP bar should update visibly at the top of the arena.

### Notifications and mailbox

- Add a persistent **Mailbox → Notifications** view. The current toast queue is transient and disappears after display; it is not a mailbox.
- Put a highlighted count badge on the mailbox for unread notifications.
- A notification entry should retain its icon, title, message, and date. Players can keep an entry or delete it; keeping means it remains in the mailbox after it is read.
- The toast still appears when a weapon unlock is earned. The mailbox record must remain available even after the toast closes or the player leaves the arena.
- Decide whether opening the mailbox marks every visible message read, or whether entries need an explicit read action. Decide any retention cap before implementation.

### 24-second damage challenge

- Add a **24-second damage challenge** that repeatedly activates the selected available weapon against the stationary dummy. Display the countdown and running damage total.
- Add a **Spam** toggle in the bottom arena bar. It is automatically on when the 24-second challenge starts. Outside this mode it can be switched manually, subject to the selected weapon's normal activation behavior.
- The run records the final total damage for that weapon/build and shows a celebration naming its achieved tier. Tier names are placeholders for now; the user will provide final names later.
- Use damage thresholds at `0`, `1,000`, `5,000`, `1,000,000`, `5,000,000`, and `100,000,000`. Award an achievement for each threshold reached, with duplicate awards prevented. The user described `0` and `1–1,000` as an **“At Least You Tried”** tier and identified the higher thresholds, but exact inclusive boundaries and names for all tiers remain to be settled.
- Save each result so players can see their best damage per weapon and configuration. Whether to keep only a personal best or a full history is undecided.
- Clarify whether the 24 seconds use wall-clock time or simulation time. Recommended default: visible wall-clock countdown, with the browser-tab-hidden state pausing the challenge so the result is fair.

## Existing systems and integration points

| Need | Existing system | Required extension |
|---|---|---|
| Buy rack access | `artifacts/survivor-616/src/game/data/lokShopUnlocks.ts` defines permanent LokShop feature unlocks; `LokShopScreen` presents shop stock. | Add a rack unlock entry and connect it to the arena's access gate. Choose its price tier and item copy. |
| Per-weapon kill credit | Run completion flows through `completeRun` in `artifacts/survivor-616/src/game/state/metaStore.tsx`; `RunResult` currently has aggregate/enemy kill data but no per-weapon kill map. | Track weapon attribution through combat and include per-weapon kills in the completed run result. Merge them into persistent meta progression only in `completeRun`. Decide how status ticks, assists, evolutions, and multi-hit attacks assign the kill. |
| Persistent progression | `MetaState` and its reducer in `artifacts/survivor-616/src/game/types.ts` and `metaStore.tsx` persist account/run meta data. | Add validated, backward-compatible fields for rack ownership, per-weapon kill progress, dummy damage, operator training XP if distinct, and challenge records. |
| Current unlock toasts | `MetaState.pendingNotifications`, `dismissNotifications`, and `ui/NotificationToasts.tsx` support short-lived announcements. `PendingNotification` currently has text/date but no icon. | Extend the notification data with an optional icon reference for weapon unlocks. Keep existing toast behavior while also writing the item to the persistent mailbox. |
| Mailbox | No persistent player notification mailbox panel or read/keep/delete state was found in the current game UI. | Add mailbox data and UI with unread badge, read state, keep/delete controls, and accessible keyboard focus. Do not treat the world mailbox prop as this feature; it is a destructible arena prop. |
| Achievements | `artifacts/survivor-616/src/game/data/achievements.ts` and the achievement completion path in `metaStore.tsx` define and persist achievements. | Add six timed-damage milestones and award each once at its threshold. Confirm if the zero-damage threshold should award an achievement or only a tier celebration. |
| Operator level | Existing character/operator mastery and level progress are exposed through meta progression helpers, including `game/data/characterMastery.ts` and archive UI. | Confirm which operator level this arena bar represents and whether arena XP contributes to existing lifetime mastery or a separate training level. |
| Arena scene | `artifacts/survivor-616/src/ui/WeaponTrainingArenaScreen.tsx` owns the current arena, rack, combat preview, target health choices, and attack readouts. | Extend its fixed viewport layout with the fixed left rack, top XP bar, compact stats/effect readout, target modes, spam control, and timed challenge. Keep rack scrolling internal. |
| Localization | Player-facing copy is in locale JSON such as `artifacts/survivor-616/src/locales/en.json`; the original arena component has hardcoded text. | Add all new copy and placeholder achievement/tier strings through localization. Include translations or mark untranslated locales for follow-up. |

## Suggested visual review checklist

- Wide and narrow viewports: the arena remains the focal point; rack scrolling does not move the page or arena; controls remain reachable and do not cover either actor.
- Weapon rack: locked/available states, progress `x/616`, selected state, icon, and long catalog behavior.
- One shot of each weapon family, including delayed attacks, damage-over-time, criticals, orbit/ring attacks, status effects, and weapons with secondary actors. Confirm the effect list agrees with what is drawn.
- Base/Level toggle and the operator XP bar, including an attack, a critical, and XP progress across a level boundary.
- Target durability settings, Non-lethal, and Infinite HP; attacks should finish their preview without pausing or leaving effects stuck.
- 24-second challenge start, automatic Spam enablement, countdown completion, final stats, celebration, each achievement boundary, and best-result persistence.
- Weapon unlock at run end, icon toast, mailbox badge, read/keep/delete actions, and persistence after leaving and reopening the hideout.
- Keyboard navigation, focus visibility, reduced-motion behavior, and screen-reader names for rack entries, progress, timer, and stat values.

## Decisions still needed

1. **LokShop price:** Which LokToken tier/price buys Weapon Rack access?
2. **616 kill attribution:** Does the weapon that deals the final damage get credit, including burn/status/evolved attacks? How should kills from a combined attack or companion be attributed? Do all normal run modes count?
3. **Counter timing:** The user decided progress only unlocks after the run ends. Confirm whether the HUD shows provisional `run kills + saved kills` during the run while the durable counter stays unchanged, or shows only saved progress until results.
4. **Multi-weapon requirement:** Is 1,000,000 dummy damage cumulative lifetime damage (recommended), or a single arena visit? Does it count every target mode and every weapon level?
5. **Base / Level:** Does this choose weapon level 1 versus a chosen weapon upgrade level, the operator's base versus current run level, or both? What is the maximum level and should evolved forms be selectable?
6. **Arena XP:** Does XP count each activation, each landed hit, or each target hit? Does a critical receive 0.3 total XP or 0.3 plus the base 0.1? Does arena XP use existing operator mastery progression or a separate level bar? Add a rate limit if the feature can be spammed indefinitely.
7. **Challenge rules:** Wall-clock versus simulation time; one weapon versus a multi-weapon loadout per attempt; whether the player may swap during a trial; and best-only versus complete result history.
8. **Tier table:** Confirm exact inclusive ranges and names, especially how 0, 1–999, 1,000, and 5,000 are grouped. Confirm whether milestones grant only achievements or also rewards.
9. **Mailbox behavior:** Whether opening auto-marks read, whether keep is the default, whether delete is permanent, and whether old notifications have a storage cap.
10. **Visual approval:** Complete the checklist above in a live browser before marking the feature complete.

## Recommended implementation order

1. Add persisted progression types and the LokShop rack unlock; show ownership and each weapon's `x/616` progress.
2. Add combat kill attribution and credit only when a completed run is committed; add icon-bearing unlock announcements and persistent mailbox entries.
3. Improve the fixed arena layout, stats/effect panel, target modes, Base/Level control, and operator XP bar.
4. Add cumulative dummy damage and the one-million-damage multi-weapon gate after the accumulation rule is approved.
5. Add the 24-second challenge, saved results, tier celebration, and one-time threshold achievements.
6. Localize the new interface, then complete the visual review checklist at desktop and mobile widths.

Do not merge implementation while the unresolved rules above change progression credit, saved data shape, or achievement boundaries. Small visual work that does not depend on those rules can proceed after this spec is reviewed.
