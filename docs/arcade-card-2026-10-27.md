# Survivor616 arcade card — 2026-10-27

Owner: Codex. Scope: App entry, AttractMode presentation and version/public notes. Issue: #368. Status: ready for review.

`?embed=card` mounts only the existing attract simulation, bypassing saved progression, account, cloud and music providers. The ordinary intro retains its existing saved toggle, dimming and controls. Card mode shows the real engine at full opacity without menus or buttons. Balanced caps rendering at 30 fps/DPR 1; Lok uses the existing DPR 1.5 cap. A readiness message follows the first rendered gameplay or showcase frame. GSix validates origin/source, retains a static poster until ready, and unloads the frame on hover exit, offscreen, hidden tab or Potato mode.

Checked: TypeScript and production builds pass. Chromium rendered one canvas, zero buttons, and no page errors. Captured the real canvas for the hub static thumbnail. The view wrote only existing runtime heartbeat/feed-visit keys, with no progression save or account providers. All 1,224 tests pass after regenerating the public update feed; the 35 focused changelog/feed/quick-fight checks also pass. Existing source artwork remains unchanged.

Version 0.42.56 and public update feed refreshed. Next: review/merge this endpoint, allow the game deployment to finish, then merge/deploy the companion Gsixhub integration. Validate production embed host and iPhone after deployment. This task did not publish a production deployment.
