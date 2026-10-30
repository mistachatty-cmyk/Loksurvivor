# Object damage and destruction effects

Object cracking and destruction are a standing major gameplay priority requested by the player. It must look like the object itself comes apart, not a crack decal over an intact box.

## Current presentation contract (0.42.59)

- `render/propFracture.ts` draws ordinary breakables and all 16 map-pack props through the same art-preserving fracture path. It reuses `blockBreak.ts`'s cached impact-grown fracture networks and gap-free triangle tiling. Dedicated ice/glass blocks retain their existing renderer.
- Up to three recorded hit origins grow layered depth/core/hairline networks over 170 ms. High damage physically separates the painted surface. Wood uses board sections, metal uses panels, and stone/glass/organic props use the shared brittle tiling.
- At destruction, clipped pieces retain the original object's artwork. They separate away from the impact, lift, rotate, settle flatter, and fade out by 2200 ms. Do not replace this with independent decorative confetti while leaving the object whole.
- `drawOrdinaryPropBody` is the extracted authored scenery painter. `drawOrdinaryPropState` keeps primed/chain/heat badges outside the cached fragments. Map-pack props expose their existing body painter to the same fracture path. Ground-plane and hit coordinates account for the ordinary 16 px top-face elevation.
- Snapshot cache: at most 24 small canvases, each at most 192 px on its longest side. Piece layouts are cached separately (96 entries). Quality bounds the number of pieces and omits fine crack branches in performance mode. No new images, downloads or runtime AI.
- `World.effectMotionEnabled` remains authoritative. With motion off, fragments are scattered in fixed poses, ambient map-prop pulses/spores freeze, and time only changes the eventual fade. Health, collision, chain reactions and rewards remain simulation-owned.
- `render/propSurface.ts` adds deterministic clipped bevels, plank seams/braces, fasteners, panel vents, masonry, reflections and veins; high/balanced/performance adds 8/4/0 wear marks. Original supplied art and authored symbols remain.
- `breakableFx.ts` still exports the legacy small FX helpers and material vocabulary; the main scenery renderer now uses `propFracture.ts` for actual destruction. Concrete barriers/crystal stumps use stone, mailboxes use metal.

## Evidence and next checks

- Unit coverage verifies full fragment area at every material/quality and the inherited ice/glass networks/tiling.
- `e2e/scenery-materials.spec.ts` checks all 96 map-prop/motion/quality expiry combinations, reduced-motion spores, original artwork carried on fragments, motion versus static poses, and canvas-state restoration.
- Interactive preview: `artifacts/survivor-616/previews/scenery-fracture.html`. Screenshots and reproduction instructions live under `docs/previews/scenery-ui/`, as requested by the owner. Keep future visual evidence in the repository too.
- Next: crowded combat on physical phones, especially cache churn when many large props break together. Chromium evidence does not establish an iPhone frame-rate or memory guarantee.
