# Training Arena next-pass spec (2026-10-13)

## Status

- **Owner:** Codex implementation; user review next.
- **Goal:** Add progression, notifications, stats, and damage challenges to the Training Arena.
- **Scope:** LokShop access, per-weapon progression, persistent notifications, training stats and target options, operator XP, multi-weapon testing, and a timed damage challenge.
- **Current baseline:** The dedicated stationary arena, Dust Mite, weapon dock, and in-screen controls are on `main` after PRs #273–#281. Related ultimate character looks and animated themes shipped in #282. See [the original handoff](training-arena-handoff-2026-10-13.md).
- **This change:** Progression and mailbox systems merged in PR #280. PR #281 added overlapping Spam activations, rack density controls, draggable/center-lock camera, retry/back challenge actions, loadout groups, weapon favorites, level controls, and the evolutions page. Spam defaults off both in the arena and at challenge start.
- **Next:** Finish the visual review with a dedicated QA save, and publish the LokShop registry only through an authorized owner session.

## Implementation decisions for this pass

- The Weapon Rack is a permanent 750 LokToken rare-tier LokShop feature unlock. The catalog SQL still needs to be applied to the shared economy before purchases can complete for real accounts.
- Each weapon earns final-hit kills during normal runs, with persistent `x/616` progress committed only when the run ends. Burn/acid ticks inherit the weapon that applied the status when available. Training Arena kills do not count.
- Multi-Weapon Testing unlocks from 1,000,000 cumulative Training Arena damage.
- Base tests at weapon level 1; Level tests at level 8. The operator bar is separate Training Arena XP, awarded 0.1 per hit and 0.3 total for a critical hit.
- The damage challenge uses a visible-tab 24-second timer. Spam starts off for each challenge attempt; the player may toggle it on explicitly. Players may activate additional weapons from the rack during the challenge; those activations overlap without clearing previous attacks. The final score's saved loadout key includes every weapon activated during that attempt. The target temporarily has infinite HP during a challenge, so target durability does not cap the score. The result panel offers Retry with the challenge's weapon set and Back to Arena.
- Opening the mailbox marks items read; keeping is optional, delete is permanent, and at most 100 items are retained.
- The six placeholder damage achievements use 0, 1,000, 5,000, 1,000,000, 5,000,000, and 100,000,000 damage thresholds in one challenge. Challenge tiers below 5,000 use “At Least You Tried.”

## Implemented and merged

- LokShop rack purchase and arena access gate; per-weapon kill progression and unlock notices.
- Persistent Notifications mailbox with unread badge, weapon icons, read/keep/delete actions.
- Arena stats/effect readout, Base/Level weapon toggle, operator Training XP bar, and durability/non-lethal/infinite target options.
- Cumulative dummy damage, multi-weapon selection, 24-second challenge, saved best per loadout/level, celebrations, and achievement milestones.
- Clicking a rack icon activates that weapon directly. Spam allows rapid activations to append attacks to the current simulation, preserving existing projectiles, effects, and target damage. Outside Spam, a running attack remains protected from interruption.
- The rack density can be set to 2, 3, or 4 columns. The player can drag the arena canvas to pan the view; Center is on by default and eases the camera back to its starting position, while Recenter resets it immediately.
- PR #281 adds saved weapon loadouts in up to four groups, theme-colored favorites, per-weapon levels, and a separate evolutions page with its own kill gate.
- Challenge results use a styled score card with Retry and Back to Arena controls.
- Player-facing copy is in the English catalog and all seven configured locales. The translation checks passed on PRs #281 and #282; review machine-generated locale wording during normal QA.
- Reducer and combat tests are included in the branch. Typecheck passed after the keyboard-accessibility follow-up. Manual preview checks covered the challenge result keyboard flow, Spam overlap, target modes, saved Classic layout, and representative weapons; broader viewport and weapon-family coverage remains.

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
- Add a **Spam** toggle beside Search and Lock in the rack header. It defaults off whenever the Training Arena loads and also starts off whenever a 24-second challenge starts or retries. Turning it off settles the current attack; turning it on during a live test resumes repeated firing.
- Show the active weapon set in a bottom bar and let players save, load, and delete named sets organized into up to four starter groups. Plan a LokShop expansion for more groups later; price and SKU are not decided.
- Let players favorite weapons from their icon buttons, sort favorites to the top of the rack, and animate a theme-colored star and level counter with reduced-motion support.
- Split the rack into animated Weapons and Evolutions pages. Keep the existing 616-kill unlock for base weapons; unlock an evolved weapon for arena use after 6,166 kills credited to its base weapon. Persist kill totals up to that threshold and show each evolution's source and progress.
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
- 24-second challenge start with Spam off, manual Spam toggle, countdown completion, final stats, celebration, each achievement boundary, and best-result persistence.
- Weapon unlock at run end, icon toast, mailbox badge, read/keep/delete actions, and persistence after leaving and reopening the hideout.
- Keyboard navigation, focus visibility, reduced-motion behavior, and screen-reader names for rack entries, progress, timer, and stat values.

## Remaining work

1. **Visual review:** Complete desktop and mobile review of the dock, actor readability, 2/3/4-column layouts, mouse/touch camera pan, Center/Recenter, keyboard focus, and reduced motion. A local preview currently reaches first-time companion setup; use a dedicated QA save rather than selecting a permanent companion just to enter the arena.
2. **Weapon coverage:** One preview confirmed 189 rack entries; this is not a check of every weapon. Glitch, meteor, DVD bounce, and arc-tether still need focused review, along with every weapon family and attacks with companion/run-state prerequisites.
3. **Progression flows:** Exercise an actual run-end 616-kill unlock, weapon-icon notification, mailbox keep/delete/persistence, and the 6,166-kill evolution gate with a QA profile. The earlier manual review opened the mailbox empty state but did not complete a weapon unlock.
4. **LokShop publishing:** A generated review copy is available at [the Survivor 616 catalog SQL](lok-registry-review/survivor616.catalog.sql); it contains 114 catalog items, including the Weapon Rack SKU. It has not been applied to the shared economy. Regenerate it from `artifacts/survivor-616` with `pnpm exec tsx scripts/export-lok-registry.ts <outDir>` when catalog content changes. Apply it only through an authorized owner session; until then, the real cross-account purchase path is unverified.
5. **Localization QA:** All configured locales and lock hashes are present, and the GitHub translation checks passed. Review machine-generated non-English wording during the full UI pass.

The implementation is merged. Shared-economy publishing and the full visual/progression review remain incomplete, so the end-to-end purchase and unlock experience is not yet fully verified.

## Follow-up review notes

- The 24-second challenge completed in the local preview. The result card focused **Retry** on open, kept Tab and Shift+Tab within the dialog, closed on Escape, and returned focus to **Challenge**. The result screen has visible focus rings on its controls.
- With Spam enabled, repeated and different rack activations overlapped while the simulation continued accumulating hits, criticals, effects, and damage. Representative families observed: wave, hazard, convert, projectile, laser, orbit, homing, nova, teleport, melee, aura, punch, and sweep.
- Infinite HP continued tracking damage without lowering the target's displayed HP. Non-lethal mode left the target alive at 4,936 / 5,000 HP after a hit. The Classic layout persisted after leaving and re-entering the arena; Main was restored as the saved default.
- The mailbox opened and displayed its empty state. Weapon unlock notification delivery was not exercised because the visual-review profile had no 616-kill progress to complete. A full view of all 189 rack entries confirmed the catalog count, but did not verify every weapon individually.
- Glitch, meteor, DVD bounce, and arc-tether attacks still need a focused visual pass, as do desktop and mobile camera dragging, every rack density, actual 616-kill unlock delivery, and the real purchase flow.
- The registry SQL for the Weapon Rack has not been applied to the shared Lok economy. The generated review copy is linked above; apply it only through an authorized owner session after confirming the target project and tenant context.
- The current local browser review reached the first-time companion choice but stopped there to avoid storing a permanent choice in the QA save. No Training Arena visual check was performed during this pass.
