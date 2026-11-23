# Design standard: original glyphs and feedback

Standing rule from Eric: no emoji, no system symbols, no stock icons anywhere in Survivor 616 or the Lok ecosystem. All icons are original Lok Facet art.
- Source: `scripts/build-lok-glyphs.py` -> `src/ui/lokGlyphs.generated.ts`. Render with `GameIcon` / `RankMarks` / `GlyphText`, or `drawGlyph` on canvas.
- Check: `node scripts/check-no-emoji.mjs` (emoji plus stock symbols). Icon-only buttons need `aria-label`.
- Feedback baseline lives in `index.css` (`.lok-glyph`). Full reactiveness standard is planned after the Queens N Kings review so both lead products reach parity; see `docs/LOK_DESIGN_STANDARD.md`.
- The shared carousel keeps its own inline star art; keep it in sync with the ecosystem copy.
