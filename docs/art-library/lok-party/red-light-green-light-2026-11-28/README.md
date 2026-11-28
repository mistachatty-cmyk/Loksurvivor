# Red Light, Green Light (Lok Party mode)

Left: green light, the owl faces away and runners sprint. Right: red light, the owl's eyes glow, two laser beams hit a runner who kept tapping, with a fireball, shockwave ring and flying parts.

How it was made: drawn live by `artifacts/survivor-616/src/party/redLightArt.ts` (Canvas2D, procedural, no bitmaps). The preview was rendered by a throwaway Vite page that called the cartridge's `render` and `hud` with hand-set states, captured with headless Chrome at 1200x800 (two 600x800 stages side by side). Rules live in `redLight.ts`.
