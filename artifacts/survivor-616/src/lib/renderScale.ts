/**
 * renderScale.ts -- keeps full-screen canvases smooth on TVs, consoles and weak phones.
 *
 * Two layers, no network, no storage:
 *  1. A starting cap. Consoles and smart TVs (Xbox, PlayStation, Tizen, webOS) report a big
 *     pixel ratio on a 1080p or 4K panel, so a full-screen canvas can be 4 to 8 million pixels per
 *     frame. They start at 1 canvas pixel per CSS pixel; phones and desktops keep up to 2.
 *  2. A frame governor. It watches the real frame time and steps the canvas resolution down
 *     when frames run long (and back up when there is headroom), so the game keeps its pace
 *     and only gets a little softer. Gameplay never changes: simulations are fixed-step.
 */

export function isConsoleBrowser(ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean {
  return /xbox|playstation|nintendo|tizen|web0s|webos|smart-?tv|crkey|aftb|bravia/i.test(ua);
}

/** Pixel ratio a canvas should start at. */
export function baseDpr(raw: number = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, consoleBrowser: boolean = isConsoleBrowser()): number {
  return Math.min(consoleBrowser ? 1 : 2, Math.max(0.5, raw));
}

export const GOVERNOR = {
  /** Frames averaged before a decision. */
  window: 60,
  slowMs: 24,
  fastMs: 15,
  stepDown: 0.85,
  stepUp: 1.1,
  floor: 0.55,
  /** Quiet windows needed before stepping back up, so it never flaps. */
  upAfterWindows: 4,
} as const;

export class FrameGovernor {
  /** Multiplier on the base pixel ratio, 0.55 to 1. */
  scale = 1;
  private sum = 0;
  private n = 0;
  private calm = 0;
  private settle = 0;

  constructor(private base: number = baseDpr()) {}

  /** Current pixel ratio to size a canvas with. */
  get dpr(): number {
    return Math.max(0.5, this.base * this.scale);
  }

  /** Feed each frame's real elapsed ms. Returns true when the resolution changed (call resize). */
  tick(dtMs: number): boolean {
    // Skip the first frames and any tab-switch hitch: they say nothing about steady speed.
    if (this.settle < 20) {
      this.settle += 1;
      return false;
    }
    if (dtMs > 250) return false;
    this.sum += dtMs;
    this.n += 1;
    if (this.n < GOVERNOR.window) return false;
    const avg = this.sum / this.n;
    this.sum = 0;
    this.n = 0;
    if (avg > GOVERNOR.slowMs && this.scale > GOVERNOR.floor + 0.001) {
      this.scale = Math.max(GOVERNOR.floor, this.scale * GOVERNOR.stepDown);
      this.calm = 0;
      return true;
    }
    if (avg < GOVERNOR.fastMs && this.scale < 1) {
      this.calm += 1;
      if (this.calm >= GOVERNOR.upAfterWindows) {
        this.calm = 0;
        this.scale = Math.min(1, this.scale * GOVERNOR.stepUp);
        return true;
      }
    } else this.calm = 0;
    return false;
  }
}
