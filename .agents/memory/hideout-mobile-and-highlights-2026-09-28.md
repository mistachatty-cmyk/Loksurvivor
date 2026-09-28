---
name: Hideout mobile collapsibility, walking-rig hero, and the kill-streak highlight
description: Why the Hideout's info sections collapse behind a per-section toggle instead of reordering the screen, why the scroll-hero reuses drawRig instead of GSAP/Lenis, and the kill-streak highlight added to runHighlights.ts.
---

## Hideout mobile scroll fix

The room nav and the Head Out tile grid sit *below* several information-heavy
sections (generators/passive income, the scene+Sanctum-links strip, the
crew rumor board, First Night + Contract boards), which on a short mobile
viewport meant scrolling several screens before reaching either. Rather than
reorder the page (explicitly deferred -- see below), each of those four
sections is now wrapped in `ui/CollapsibleSection.tsx`, collapsed to a
one-line header + chevron. Whether they start open or collapsed is a real
setting (`meta.hideoutSectionsCollapsedByDefault`, toggled in
`SettingsPanel.tsx`), not a hardcoded default, and each section's open/closed
state is local component state (resets on remount) -- deliberately not
persisted per-section, to avoid a second piece of stored state nobody asked
for.

A fixed "Head out" button (`data-testid="button-open-runs-sticky"`) was also
added, `sm:hidden`, pinned to the bottom of the viewport on mobile only,
mirroring the existing `fixed`/`onOpenRunSetup` button pattern already in
`HubScreen.tsx`. The scroll container gained `pb-24 sm:pb-6` so this bar
never overlaps the last real content (the loot-token/skeleton-key rows).

**Explicitly deferred, on the user's own call:** moving the room nav / Head
Out grid to the top of the page, above the collapsible sections. The user
asked to ship the collapse first and revisit reordering only if it's still
needed afterward -- don't do that reorder unprompted.

## The walking-rig scroll hero (`HideoutPreview.tsx`)

The user pasted a 21st.dev/Osmo GSAP+Lenis parallax component as a
reference and asked for "an actual running game" preview at the top of the
Hideout screen, fading/parallaxing on scroll, in "potato" and "advanced"
tiers. What shipped is the potato tier only: `ui/HideoutPreview.tsx` draws
the player's own selected-character rig walking back and forth with the
same `drawRig` the game itself uses (the same technique `RigPortrait.tsx`
already used for menu portraits) -- not a static image, not the GSAP/Lenis
snippet. No new npm dependencies were added; scroll-linked fade/parallax is
a plain `scroll` listener writing `opacity`/`transform` directly (same
style as the existing `visibilitychange` handling in `HubScreen.tsx`), fully
torn down under `prefers-reduced-motion` (static idle pose, no drift).

**Deliberately not built (this is the gap between "potato" and
"advanced"):** an actual `stepWorld`-driven combat simulation running behind
the header. That would mean faking a `World`, enemies, and a camera for a
strip a few hundred pixels tall -- a separate, bigger piece of work, not
attempted here. If it's ever wanted, scope it as its own pass rather than
extending `HideoutPreview.tsx` in place.

**Still open, flagged but not yet done:** a perf pass checking the new
canvas hero doesn't stack badly with the existing hideout weather/ambient
CSS layers on low-end mobile, and wiring `HideoutPreview` to the existing
`graphicsQuality`/`frameRateMode` settings the way other render-cost knobs
already do.

## Kill-streak highlight (`game/data/runHighlights.ts`)

Added `'kill-streak'` to `RunHighlightKind`, following the file's existing
diff-against-last-frame pattern exactly: a rolling window of per-frame kill
deltas (`KILL_STREAK_WINDOW_MS` = 3000ms), a threshold
(`KILL_STREAK_THRESHOLD` = 8 kills in that window), and its own cooldown
(`KILL_STREAK_COOLDOWN_MS` = 12000ms) so a sustained high kill rate doesn't
spam a highlight every frame -- the same shape `close-call` already used.
Wired into `RunSummary.tsx`'s `RUN_HIGHLIGHT_ICONS` (Flame icon); **not**
added to the narrower `events` milestone-type mapping a few lines below
(`'level' | 'boss' | 'close-call'`), since that enum lives in
`packages/recap/src/schema.ts`'s `MILESTONE_KINDS` and extending it is a
recap-package change, not a survivor-616 one. `highlightClips[].kind` in
that same package is `z.string()` (free string, per `schema.ts`), so the
new kind flows into the real clip-cutting `HighlightReel` scene without any
recap-side change needed.

## Music-surge highlight, built as a follow-up

Landed once `music-reactivity.md` was actually read: `World.audio` is
already a plain public field (`AudioFrame` from `audio/beatBus.ts`, read
elsewhere via `w.audio.energy`/`w.audio.source` in `world.ts`'s
`applyMusicEvents`/`musicMultiplier`), so this needed no new signal piped
in from `RunScreen` at all -- `RunHighlightObservable` just grew a narrowed
`audio: { energy: number; source: 'none' | 'detected' | 'studio' }` field
(not the full `AudioFrame`, so this file still never imports `beatBus.ts`),
and the real `World` object `RunScreen` already passes to `observe()`
satisfies it structurally. Fires on the rising edge past
`MUSIC_SURGE_ENERGY_THRESHOLD` (0.85) with its own
`MUSIC_SURGE_COOLDOWN_MS` (15000ms) so a sustained loud section doesn't
retrigger every frame, and never fires while `source === 'none'` (nothing
playing, or detection hasn't locked on) regardless of reported energy.
Wired into `RunSummary.tsx`'s icon map (`Music` icon) the same way
`kill-streak` was.

## Everything new here is optional, on the user's explicit request

Following on from all of the above, the user asked to make new Hideout
features individually toggleable rather than forced, so "classic" stays
available as a real option instead of just old behavior nobody can get back
to. Both new visual additions got their own on/off setting, same pattern as
`hideoutWeatherEnabled`/`hideoutAmbienceEnabled`: `hideoutPreviewEnabled`
(the walking-rig hero, default on) and `hideoutStickyHeadOutEnabled` (the
mobile sticky Head Out button, default on). Both are gated in `HubScreen.tsx`
with a plain `meta.xEnabled &&`, and the scroll container's bottom padding
(`pb-24 sm:pb-6` vs `pb-6`) follows the sticky-button toggle so there's no
dead space when it's off. `hideoutSectionsCollapsedByDefault` (added
earlier in this same pass) already covered the collapsible-sections side of
"classic mode" -- set all three off and the Hideout screen is back to
exactly its pre-2026-09-28 layout.

**Still open:** the user separately asked for a broader settings-page
redesign at some point (current `SettingsPanel.tsx` is one long flat list of
toggle rows) while explicitly keeping "classic" (the current flat list) as
a selectable option, not a replacement. Not attempted in this pass --
scope it as its own design pass rather than bolting a partial redesign onto
this one.

## Currency glossary

Added `title` attributes (cred / loot tokens / skeleton keys / LokTokens)
to the Session Stats block in `HubScreen.tsx` first, as a cheap step --
then caught, on review, that `title` tooltips need hover, which does not
exist on a touch screen. The device this entire thread of work has been
about could not actually use them. Fixed with `ui/CurrencyGlossary.tsx`, a
tap-to-reveal card toggled by a `HelpCircle` button next to "Session
Stats" (local `showCurrencyGlossary` state, no new settings field -- this
is a discoverability aid, not a persistent preference). The `title`
attributes stay as a desktop-hover bonus, not the primary mechanism.

Still open: a proper first-run tour (walking a new player through the
Hideout's rooms, not just currencies) is a bigger, separate piece of work.
