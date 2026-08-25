# 616 Survivor

A browser-based survivor game set in a fictionalized 616 Grand Rapids night.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/survivor-616/src/game/` — gameplay engine, rendering, data, sprites, and run state.
- `artifacts/survivor-616/src/ui/` — hub, roster, archive, area selection, music, and run summary screens.
- `artifacts/survivor-616/public/art/` — supplied scene and character artwork.
- `AGENTS.md` and `COLLABORATION.md` — shared Gemini, Claude, Replit Agent, and GitHub handoff rules.
- `.agents/memory/` — durable game decisions and asset constraints.

## Architecture decisions

- GitHub `main` is the integration baseline; focused work should arrive through pull requests.
- Gameplay systems remain under `artifacts/survivor-616/src/game/`, separate from presentation under `src/ui/`.
- The supplied pixel-art assets are preserved and must be rendered according to the asset notes.

## Product

Players survive escalating waves across urban arenas, unlock characters and areas, collect upgrades, return to a hideout hub, and play music selected from their own device.

## User preferences

The user wants Gemini, Claude, Replit Agent, and GitHub to work from one shared project with explicit handoffs.

## Gotchas

- Read `AGENTS.md` and `COLLABORATION.md` before changing gameplay or UI.
- Run `pnpm --filter @workspace/survivor-616 run typecheck` for focused checks.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
