---
name: Mobile stability and sizing findings (2026-10-22)
description: Why the Jukebox Room crashed iPhone Safari, why the app now has a fluid root font size, the short photosensitivity screen, and what to check next for performance.
---

## Findings

- **Safari "A problem repeatedly occurred" is a content-process crash (memory or graphics), not a JS error.** The error boundary never sees it. The Jukebox Room caused it through three things:
  1. A full-screen `filter: hue-rotate()` restyled every frame.
  2. CSS variables written on the room root every animation frame, which restyles every 3D disc below it.
  3. Swiping a disc called `playTrack` for every disc passed (a new audio load each time).
  Rules now: the grade writes `opacity` straight onto two small layers via refs, about 12 times a second, paused when the tab is hidden. Never put a filter or a per-frame variable write on an ancestor of the disc carousel. Swiping only browses; tapping the middle disc plays it.
- **A stale cached build** (home-screen app open across a deploy) can ask for a code chunk that no longer exists. `main.tsx` now reloads once on `vite:preloadError`, and the arrival disc shelf sits in its own error boundary.
- **The real error text is hidden in production**, so a crash on a phone could not be diagnosed. Crash reports (shared SDK `crash.ts`, `src/lib/lokCrash.ts`) now keep the latest report on the device (error code + Copy report on the crash page) and send it only if the server migration in Lok-EcoSystsem `docs/LOK_CRASH_REPORTS.md` has been applied.

## Sizing (dynamic UI scale)

`index.css` sets `html { font-size: calc(clamp(13.5px, 3.45vw, 16px) * var(--text-scale, 1)) }`. Every rem size follows the screen width on phones; the Settings text size multiplies it through `--text-scale` (see `lib/textScale.ts`). Do not set `html` font-size inline again, or the fluid scale is lost. The notification mailbox button is icon-only below the `sm` breakpoint so it stops covering content.

## Photosensitivity screen

Title + one sentence (under 20 words) whose words rise in one at a time + Continue. "More info" opens the full guidance (the old body, triggers, stop signs, tips). No scrolling at 390x664. Glow and shimmer are slow and shallow, never a flash, and off under reduced motion.

## Optimization notes for next time

- Main bundle is about 3.3 MB (about 960 kB gzipped); the disc carousel adds a separate 30 kB chunk (about 11 kB gzipped) loaded only when used. The big win left is splitting the main bundle (code-split the largest screens).
- The disc carousel keeps all 12 discs mounted (hidden ones are `visibility: hidden`). If low-memory phones still struggle, render the art only for discs within about 3 positions of the chosen one (change it in the shared component, keep its tests).
- The sheen layer uses `mix-blend-mode: screen` on every disc; `sheen={0.35}` is a cheap way to lighten it.
- Verify audio and iOS behavior on a real iPhone: this sandbox has desktop Chromium only.
