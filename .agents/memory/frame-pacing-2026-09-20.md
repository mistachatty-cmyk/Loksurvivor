---
name: Frame pacing and VFX pressure control — 2026-09-20
description: 60/120 frame pacing with renderer-only adaptive scaling and camera-aware VFX culling.
---

# Frame pacing and VFX pressure control

`MetaState.frameRateMode` is the player's persisted `60 | 120` preference.
The simulation remains fixed at 60 Hz in `RunScreen`; 120 only asks the
browser to redraw on every available animation frame. A 60 preference uses a
deadline rather than a fixed count of RAF callbacks, so it remains close to
60 FPS on 90/120/144 Hz displays.

The run loop measures sustained render pressure in half-second windows. It
can lower the canvas backing scale from 1.0 to 0.6 and restores it gradually
after recovery. This is presentation only: it never removes simulated
enemies, changes damage, drops rewards, or lowers the fixed simulation step.

`renderWorld` additionally culls off-camera effects, projectiles, particles,
and damage popups. Under pressure it samples decorative effects and caps
visible particles/popups, while preserving telegraphs and combat-readable
effects (`laser`, `hazard`, `nova`, `ring`, `wave`). Keep any future visual
budgeting renderer-only; world simulation must remain authoritative.
