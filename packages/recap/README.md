# @lok/recap

Renders a LokSurvivor run into a shareable video with Remotion.

- `src/schema.ts` — the contract. Everything the video shows arrives through here.
- `src/adapter.ts` — maps the game's run summary onto that contract.
- `src/RunRecap.tsx` — scene assembly.
- `src/scenes/` — ColdOpen, StatSlam, RunArc, Sendoff.

14s at 30fps. Two compositions: `RunRecapVertical` (1080x1920) and
`RunRecapWide` (1920x1080). Same tree, sized off composition width.

```bash
pnpm studio     # live props editor
pnpm render     # out/recap.mp4
```
