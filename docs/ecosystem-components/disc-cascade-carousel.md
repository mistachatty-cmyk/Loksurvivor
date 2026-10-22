# Disc Cascade Carousel (shared Lok ecosystem component)

Source: `artifacts/survivor-616/src/components/ui/disc-cascade-carousel.tsx` (from 23dev, unmodified). Tests: `disc-cascade-carousel.test.ts` next to it (pure motion and label helpers).

Keep this file and the component identical across Lok apps. The ecosystem copy belongs in the `Lok-EcoSystsem` repo (not attached in the session that added this); copy the component, its test and this doc there when access exists.

## What it is
A carousel of printed discs on a slanted line. Drag, flick, arrow keys, sideways trackpad swipe, buttons or a menu move one number (the position) chased by two springs. Frames are written straight to the DOM and stop when the springs settle. Disc labels are your image (`src`) or generated as SVG (seven patterns, a palette, the title on an arc or in a block), so it needs no assets. React is the only import. It carries its own CSS and needs no Tailwind.

## Compatibility checked in 616 Survivor
- shadcn path: `components.json` present, components live in `src/components/ui`, alias `@/components/ui/...`.
- Tailwind v4, React 19, TypeScript strict: `pnpm typecheck` passes.
- `"use client"` is a harmless string in Vite.

## Lok rules when using it
- No `fontHref` (cost discipline: no new web fonts). Pass the game's own font stacks through `serif`, `sans`, `display` if needed.
- No `src` images unless the owner asks. Use generated labels (`pattern`, `palette`, `label`).
- No stock photo demo. The original demo used Unsplash photos; do not ship that.
- Never name a prop, class, id or copy "signal" (house rule).
- It respects `prefers-reduced-motion`. Keep it that way.

## Minimal usage (chrome off, discs only)
```tsx
import DiscCascadeCarousel, { type DiscCascadeItem } from '@/components/ui/disc-cascade-carousel';

const discs: DiscCascadeItem[] = [
  { title: 'Save My Grace', pattern: 'rings', palette: ['#141414', '#e9e4da', '#c8a24a'] },
  { title: 'Null Void', pattern: 'eclipse', palette: ['#0e0620', '#3a1f6b', '#ff2ec4'] },
];

<DiscCascadeCarousel
  items={discs}
  loop
  height="100svh"
  background="transparent"
  frame={false}
  details={false}
  reviews={false}
  controls={false}
  hint=""
  indexLabel=""
  brand=""
  ariaLabel="Soundtrack discs"
/>
```

## Props worth knowing
`items`, `height` (must be a definite length), `discSize`, `loop`, `autoplay` (ms, 0 off), `index` / `defaultIndex` / `onIndexChange` (controlled use), `onSelect` (tap the chosen disc), `spin` (idle seconds per turn, 0 stops), `sheen`, `background`, `color`, and the toggles `details`, `reviews`, `controls`, `frame`, `hint`, `brand`, `nav`, `indexLabel`.

## Item fields
`title`, `label` (printed text, "" prints none), `labelStyle` (`arc` | `block`), `pattern` (`sunburst` | `rings` | `halftone` | `horizon` | `stripes` | `eclipse` | `mosaic`), `palette` (background, figure, accent), `ink`, `fine` (rim text), `src`/`alt` (image label), `credits`, `reviews`.

## Known behavior to remember
- A touch drag past 6 px becomes a drag; a tap on a non-chosen disc moves to it; a tap on the chosen disc calls `onSelect`.
- Idle spin only runs on the chosen disc and pauses while dragging.
- `autoplay` pauses off-screen, in a hidden tab, while focused, dragging, or after any interaction.
