# Deploying 616 Survivor to Vercel

This repository is configured as a Vercel static deployment for the
`artifacts/survivor-616` Vite app.

## Vercel project settings

When importing the repository, keep the Vercel **Root Directory** at the
repository root. The checked-in `vercel.json` supplies the build and output
settings:

- Install: `pnpm install --frozen-lockfile`
- Build: `pnpm --filter @workspace/survivor-616 run build`
- Output: `artifacts/survivor-616/dist/public`

No runtime environment variables are required for the game to build or run.
Replit still provides `PORT` and `BASE_PATH` for its own workflow; Vite
defaults to the standard hosted values when those variables are absent.

## Optional: account features (cloud saves, sign-in)

The intro screen's "Sign in" button, the post-run "save your progress"
nudge, and cloud save sync all gate themselves off automatically when auth
isn't configured (see `authStore.tsx`'s `available` flag) — the game plays
identically without them. To turn those features on, set these in the
Vercel project's Environment Variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Both come from the Supabase project's API settings. Leave them unset to
ship the game with account features quietly disabled.
## Builds are tag-gated (2026-11-24)
`vercel.json` has an `ignoreCommand`: a push builds only when the latest commit message contains `[deploy]`. It reads Vercel's `VERCEL_GIT_COMMIT_MESSAGE`, not `git log`: `.vercelignore` removes `.git` before the command runs, so a `git log` check always failed and skipped every build (fixed 2026-11-26). Other pushes are skipped, so the free Vercel usage is safe. Add `[deploy]` to the last commit only when Eric says to deploy.
