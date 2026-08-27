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

No runtime environment variables are required for the game. Replit still
provides `PORT` and `BASE_PATH` for its own workflow; Vite defaults to the
standard hosted values when those variables are absent.