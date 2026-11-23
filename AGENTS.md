# Loksurvivor AI Collaboration Guide

This repository is the shared working space for Loksurvivor. Gemini, Claude, and Replit Agent should use the same handoff rules and GitHub workflow.

When the user says **“Pullcheck,” read `docs/PULLCHECK.md` first**. It records PRs intentionally excluded from routine review and the current triage procedure.

## Before starting work

1. Read `COLLABORATION.md`.
2. Read the relevant notes in `.agents/memory/`, and the latest handoff in `docs/` (currently `docs/ai-handoff-2026-10-04.md`).
3. Check open GitHub issues and pull requests before choosing a task.
4. Claim one issue or create one before making a substantial change.

## Ownership and handoffs

- Keep each change focused on one issue or one clearly described improvement.
- Record the current owner, status, files in scope, and the next action in the issue or pull request.
- Do not rewrite another agent's unmerged work. Coordinate in the issue or branch from the latest `main`.
- Treat `main` as integration-ready. Work on a descriptive branch and use a pull request for review.
- The final handoff must include what changed, how it was checked, known limitations, and the next suggested task.

## Agent roles

- **Replit Agent:** implementation, local preview, integration, and resolving conflicts.
- **Claude:** focused feature implementation and code changes on an isolated branch.
- **Gemini:** design critique, gameplay ideas, balancing, and targeted implementation when assigned.
- **GitHub:** source of truth for issues, branches, pull requests, review discussion, and history.

## Game-specific guardrails

- Preserve the supplied pixel-art assets and follow `.agents/memory/survivor-616-art-assets.md`.
- Keep endless-mode behavior consistent with `.agents/memory/endless-mode-engine.md`.
- Do not invent real artists, names, likenesses, or licensed music. Player-selected local music is the supported soundtrack path.

## Design standard: no emoji, no stock icons (Lok ecosystem rule, before MVP)

Nothing that looks like it was grabbed off a phone or an icon pack: no emoji, no system symbol glyphs
(arrows, stars, hearts, geometric shapes), no stock icon libraries for game or brand art.
- Every icon is original Lok Facet art. Source: `scripts/build-lok-glyphs.py` (24x24 grid, straight edges, split shards). Run it after editing; it writes `artifacts/survivor-616/src/ui/lokGlyphs.generated.ts`.
- UI: store a glyph KEY in data and render with `<GameIcon name="..." />`. Rank marks use `<RankMarks />`; "->" in strings renders as the Lok arrow via `<GlyphText />`.
- Canvas: `drawGlyph(ctx, key, x, y, size)` from `ui/lokGlyphCanvas.ts` (same paths).
- Plain text alerts and popups use words only.
- Run `node scripts/check-no-emoji.mjs` before every commit; it fails on emoji and stock symbol glyphs.
