/**
 * Recap design tokens.
 *
 * These mirror the Lok system palette so a recap frame read next to the game
 * HUD looks like the same product, not a marketing asset bolted on afterwards.
 */

export const color = {
  void: '#0A0B0E', // page ground
  panel: '#14171C', // raised surface
  line: '#232830', // hairline / divider
  text: '#E8EDF2',
  muted: '#6B7681',
  accent: '#5EEAD4', // survival, progress, the player's own numbers
  heat: '#FF6B5B', // damage, death, the thing that ended the run
  gold: '#F2C14E', // personal bests only — never decoration
} as const;

/**
 * Swap `display`/`body` for whatever the game ships once fonts are bundled.
 * Kept as a stack (no network fetch) so renders stay deterministic offline.
 */
export const font = {
  display:
    '"Chakra Petch", "Rajdhani", ui-sans-serif, system-ui, -apple-system, sans-serif',
  body: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: 'ui-monospace, "SF Mono", "JetBrains Mono", monospace',
} as const;

/** Matches the spring curve used across Lok UI. */
export const springConfig = {
  damping: 18,
  mass: 0.7,
  stiffness: 130,
} as const;

export const FPS = 30;

export const scene = {
  coldOpen: { from: 0, durationInFrames: 60 },
  statSlam: { from: 60, durationInFrames: 150 },
  arc: { from: 210, durationInFrames: 120 },
  sendoff: { from: 330, durationInFrames: 90 },
} as const;

export const TOTAL_FRAMES = 420; // 14s at 30fps
