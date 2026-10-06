---
name: Demo Day page overlay
description: Running the Survivor 616 engine on top of any live web page (DOM becomes breakable obstacles); the design rules, engine hooks, bundle, and what the Phase 0 spike proved.
---

Read before touching `src/overlay/*`, `vite.overlay.config.ts`, the `page-block` obstacle kind,
`addBreakables`/`removeBreakables`, or `Viewport.overlay` in `draw.ts`.

## What it is

"Demo Day" (working name, not final) runs The Foreman on a transparent canvas stacked over a live
third-party page. Page elements become `page-block` obstacles; broken ones vanish from the real page
(reversibly). Delivered as one IIFE (`pnpm build:overlay` -> `dist/overlay/demoday.js`) loaded by a
bookmarklet, a LOK floating button, or a browser extension. The full product/monetisation/marketing
plan lives outside the repo; this note is the engineering contract.

## Engine hooks (additive, all tested in `pageOverlay.test.ts`)

- `ObstacleDef.kind: 'page-block'`, optional `hp` (per-instance, overrides the kind table) and `domId`
  (opaque handle the host maps back to a DOM node; the engine never reads it).
- `PropVariant 'fixed-breakable'`: immovable like `fixed-bench` but still takes damage. `fixed-bench`
  forces `breakable:false`, which is why a new variant was needed.
- `addBreakables(w, defs)` / `removeBreakables(w, uids)`: batch add/remove on a running world with a
  single `syncObstacleAabbs` (it is O(n), so one call per batch, never per block). Mirrors the
  endless-chunk rebuild at the `obstacleGridDirty` sites.
- `page-block` is in `PROJECTILE_BLOCKING_KINDS` (shots are absorbed and damage it) and pays XP on break
  (drives level-ups; there are no enemies by default).
- `Viewport.overlay` in `renderWorld`: `clearRect` instead of the dark fill, and skips ground, tint,
  lighting, sky, fog, arena edges, vignette, lightning and `drawObstacles`. Actors, pickups, effects,
  projectiles, particles and popups still draw.
- `AreaDef.bounds` is the FULL extent (the engine halves it everywhere) despite the type comment saying
  "half-extents". World = page - docSize/2.

## Hard rules (each one cost something to learn)

1. **Never restructure the host DOM.** No word `<span>` wrapping (the reference clone does it; it breaks
   React/Vue hydration on a live page), no removing nodes. Destruction writes exactly ONE inline style
   property per element: `visibility` (whole element) or `clip-path: path(evenodd, ...)` (holes). `PageHider`
   saves the original value + priority and `restoreAll()` is exact. Esc / the Exit button always restore.
2. **Hitboxes must hug the glyphs.** Block-level `p`/`h2` rects span the whole column; as obstacles they
   boxed the player in and capped at 420 HP. Text is measured per rendered line with `Range.getClientRects()`
   and split into ~120px chunks (`chunkLine`), owned by the nearest non-inline ancestor (`clip-path`
   reference box is only well defined for block-level boxes). Whole-element `box` blocks are limited to
   media/controls and small (<=360px) painted boxes.
3. When a `box` is hidden, every block nested inside it must be destroyed too, or it lingers as an
   invisible wall (`destroyNestedIn`).
4. **Do not copy RunScreen's keydown handler.** It `preventDefault`s arrows/space unconditionally. The
   overlay ignores keys whose `composedPath()[0]` is editable (shadow retargeting makes `event.target` the
   host), lets a focused button/link keep Space, and arms nothing it cannot undo.
5. Fixed/sticky elements are skipped (their page position drifts with scroll). Spawn-point blocks are
   skipped (`skipBlocksNear`) so the player is not born inside a wall.
6. Doc size is fixed at start (world origin = doc/2). Infinite-scroll pages only play over what was
   loaded at start. Known limitation.
7. The sensitivity denylist (password inputs, payment iframes, bank/health/gov hosts) refuses to start.
   Nothing about the page (URL, text, screenshot) is ever sent anywhere.

## Pixel layer (from Sprite Fusion's blog post)

The visible canvas IS the low-resolution buffer (viewport / 2) scaled up by CSS `image-rendering:
pixelated`, so there is no second upscale pass. `targetViewOverride = lowW * PIXEL` makes 1 world unit ==
1 CSS px on screen. `world.camera` is overwritten each frame from the real scroll (`cameraForScroll`) and the
window scrolls to follow the player (`scrollTargetFor`), so the canvas and the page stay locked together.

## Spike results (Phase 0, headless Chromium, software rendering)

- Bundle 797 KB raw / **230 KB gzip** (57 modules, nothing trimmed yet; budget 450 KB gzip).
- Mount 80-135 ms; 60 rAF fps on a 2k-line fixture and a 507 KB / 600-section page. Headless only: this
  proves frames are not dropped, NOT that a mid-range laptop holds 55 fps. Re-measure on real hardware.
- Esc leaves zero `visibility`/`clip-path` styles behind. Strict page CSP: the loader gets `onerror` plus a
  `securitypolicyviolation` event naming the URL; the page is untouched (use this for the "use the
  extension" message).
- With no enemies the Foreman still breaks blocks in reach (weapons fall back to facing; novas/auras damage
  breakables directly). His 1.9 s meteor cooldown is slow for a demo; tune before shipping.

## Shipping and the hub side

- `pnpm build` now also emits `dist/public/demoday.js` (`vite.overlay.config.ts --mode public`, which must not
  wipe the site build); `vercel.json` gives `/demoday.js` open CORS and a 5-minute cache. It is served from
  `survivor.gsix.online/demoday.js`. Static files win over the SPA catch-all rewrite, so no rewrite change.
- The GSix hub (repo `Gsixhub`, `apps/hub/DEMODAY.md`) has the designed pages `/games/demoday` and
  `/games/demoday/report`, a registry entry (`kind: "overlay"`), and the Tamagotchi button that starts the overlay
  in place. The pages load the bundle from the URL above with `referrerPolicy = "no-referrer"`.
- Report contract: on stop the overlay shows an end card whose "Save & share" link is
  `https://gsix.online/games/demoday/report#r=<base64url {"v":1,"pct","kills","level","sec","ch"}>`. The
  fragment is never sent to a server and carries no page address. `src/overlay/runLink.ts` is the encoder; the hub's
  `lib/demoday-report.ts` is the validating decoder. Change both together.
- Nothing on the hub pages works until this repo is deployed with the overlay; until then the hub's Wreck button
  reports "Try again" and the Tamagotchi falls back to Sprite Fusion's tool.

## Not done yet (Phase 1 backlog)

Strings are English constants in `overlay/strings.ts` (the bundle cannot use React `useT()`); move to
`en.json`. No MutationObserver re-scan, no per-site persistence, no LOK dock (hub links / music / pet), no
`changelog.ts` bump (nothing player-visible ships until the loader exists). Hub-side: the Tamagotchi
"Destroy this site" button should start the overlay in place and keep the Sprite Fusion link as fallback.

## Credit

Inspired by Sprite Fusion's *Destroy Any Website* (Hugo Duprez). Keep the credit link in the overlay
(`CREDIT_URL`); the GSix hub already credits it the same way (`apps/hub/lib/destroy-site.ts`).
