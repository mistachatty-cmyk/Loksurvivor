# Loksurvivor AI Collaboration Guide

This repository is the shared working space for Loksurvivor. Gemini, Claude, and Replit Agent should use the same handoff rules and GitHub workflow.

## Before starting work

1. Read `COLLABORATION.md`.
2. Read the relevant notes in `.agents/memory/`.
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