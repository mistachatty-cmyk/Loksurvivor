# Loksurvivor Collaboration

## Shared source of truth

GitHub repository: https://github.com/mistachatty-cmyk/Loksurvivor

The repository's `main` branch is the integration baseline. GitHub issues describe work, pull requests contain changes, and review comments contain decisions. The local Replit preview is for validating the integrated result.

## Standard handoff

Every issue or pull request should state:

- **Owner:** Gemini, Claude, or Replit Agent
- **Goal:** one sentence
- **Scope:** files or systems that may change
- **Status:** `ready`, `in progress`, `blocked`, or `ready for review`
- **Checked:** commands or manual checks completed
- **Next:** the exact next action for another collaborator

Use labels and issue titles to make work easy to scan. Prefer small pull requests that can be reviewed and merged independently.

## Suggested flow

1. Choose an open issue, or create one with acceptance criteria.
2. Announce ownership in the issue before coding.
3. Create a branch from the latest `main`.
4. Make the smallest complete change.
5. Run the relevant typecheck/build or preview check.
6. Open a pull request linking the issue.
7. Ask another collaborator for review, resolve feedback, and merge only when the handoff is complete.

## Current game map

- `artifacts/survivor-616/src/game/` — gameplay engine, rendering, data, sprites, and run state.
- `artifacts/survivor-616/src/ui/` — hub, roster, archive, area selection, music, and run summary screens.
- `artifacts/survivor-616/public/art/` — supplied scene and character art used by the game.
- `.agents/memory/` — durable design and engineering decisions that collaborators must preserve.