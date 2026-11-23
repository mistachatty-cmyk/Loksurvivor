# Lok design standard (art, feedback, parity)

Status: art rules are final and enforced. The feedback rules are a baseline; the full reactiveness standard is written after the Loks Queens N Kings review, so both lead products meet it together.

## 1. Art rules (final, enforced before MVP)
- No emoji anywhere: UI, copy, data, alerts, popups, favicons, docs, generated file headers.
- No system symbol glyphs (arrows, stars, hearts, geometric shapes, dingbats). On phones they can turn into emoji and they read as stock.
- No stock icon packs for game or brand art. Everything is original Lok art.
- The set is **Lok Facet**: 24x24 grid, straight edges only, 30/45/60 degree angles, solid shards split by a thin slit. Source of truth: `scripts/build-lok-glyphs.py` (writes `artifacts/survivor-616/src/ui/lokGlyphs.generated.ts`). Edit the script, run it, commit both.
- DOM: `<GameIcon name="..." />`, `<RankMarks rank={n} />`, `<GlyphText text="a -> b" />`. Canvas: `drawGlyph(ctx, key, x, y, size)` in `ui/lokGlyphCanvas.ts`. Same paths for both.
- Data files store glyph keys, never characters. Plain-text alerts and popups use words.
- Guardrail: `node scripts/check-no-emoji.mjs` fails on emoji and stock symbols. Run it before every commit.
- The shared Disc Cascade Carousel carries its own copy of the star art so it stays portable (see `docs/ecosystem-components/disc-cascade-carousel.md`).

## 2. Feedback baseline (what exists now)
Every glyph inside a control answers the pointer (`index.css`, `.lok-glyph`):
- Hover or keyboard focus: lifts 12 percent with a soft glow (140 ms).
- Press: snaps down to 86 percent (60 ms).
- Disabled: dimmed and desaturated.
- State change: `pop` prop plays a 260 ms pop (used for the Studio journey checks).
- Icons never swallow clicks (`pointer-events: none`), so handlers see the button.
- Reduced motion removes the movement. Power-save removes the glow. CSS only, no per-frame cost.
- Icon-only buttons must carry an `aria-label` (Studio arrows and Bestiary clear were fixed).

## 3. Reactiveness standard (to write after the Queens N Kings review)
Draft contract to confirm, not yet binding:
- Every interactive element has five states: rest, hover/focus, press, disabled, busy.
- Every action answers within 100 ms: visual first, then sound, then haptics where the platform allows.
- Success, failure and cost are each shown, never silent (a purchase shows the price leaving; a failed action says why).
- Shared timing tokens (hover 140 ms, press 60 ms, pop 260 ms) so both games feel like one family.
- Reduced-motion, power-save and Calm theme variants are mandatory.
- Open questions: haptic patterns, sound cue set, loading skeletons versus spinners, replay-friendly feedback (speed-run splits, streak flair).

## 4. Parity plan: Survivor 616 and Loks Queens N Kings
Goal: both lead products meet the same bar and keep leveling each other up.
1. Review Queens N Kings with this standard: menus, world map, wardrobe, shop, online, sandbox, arcade.
2. Port the glyph set and `check-no-emoji` to its repo; draw any chess-specific glyphs in the same Facet language.
3. Compare feedback side by side, keep the better pattern of each, write the final section 3.
4. Every future interaction improvement lands in one and is offered to the other.

## 5. Ideas that need a backend (not built)
- Shared replay and speed-run splits across both games (needs a score and ghost store).
- Cross-game streak flair shown on the supporter bar and profile (needs a streak table).
- Server-side check that a purchase or reward animation matches the real balance change.

## 6. Passed list (art pass, 2026-11-22)
Done in Survivor 616: HUD and level-up cards, run screen particles and celebrations, minimap legend, card shop and rarity legend, deck cards and collection, wardrobe cosmetics (hats and celebrations), character studio, hideout emotes and props, threat matrix and sandbox modes, pet battle and evolution screens, supporter bar (public script included), pickups and canvas effects, alerts and popups.
Not yet checked: other repos in the ecosystem (see section 4).
