/**
 * Collect burst: a reward bursts out, hangs for a beat, then every piece flies into the
 * counter where the reward belongs, bumping it as each piece lands.
 *
 * `planBurst` is pure (seeded, testable). `playCollectBurst` draws the pieces with the Web
 * Animations API using the original Lok Facet "coin" glyph, so there is no new asset, network
 * call or library. Reduced motion, a hidden tab or a missing target skip the show and report
 * everything landed at once, so the number is always right even when the animation is not.
 * Design: no emoji, no stock icons; see docs/LOK_DESIGN_STANDARD.md in Lok-EcoSystsem.
 */
import { createRng } from '../game/engine/math';
import { LOK_GLYPH_PATHS } from './lokGlyphs.generated';

export interface BurstPiece {
  /** Where the piece rests during the hang, relative to the source centre (px). */
  dx: number;
  dy: number;
  /** Total spin over the flight (degrees). */
  spin: number;
  /** Stagger before this piece starts (ms). */
  delayMs: number;
}

export interface BurstPlan {
  pieces: BurstPiece[];
  flightMs: number;
  /** Time until the last piece has landed. */
  totalMs: number;
}

export const BURST_FLIGHT_MS = 1100;

/** More reward, more pieces: 3 to 12, or 3 to 4 in power save. */
export function pieceCountFor(amount: number, powerSave = false): number {
  const n = Math.max(3, Math.min(12, 2 + Math.floor(Math.log2(Math.max(1, amount) + 1))));
  return powerSave ? Math.min(4, n) : n;
}

export function planBurst(opts: { amount: number; seed: number; powerSave?: boolean }): BurstPlan {
  const rng = createRng(opts.seed);
  const count = pieceCountFor(opts.amount, opts.powerSave);
  const pieces: BurstPiece[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = 36 + rng() * 54;
    pieces.push({ dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius - 24, spin: 360 + Math.round(rng() * 240), delayMs: i * 45 });
  }
  return { pieces, flightMs: BURST_FLIGHT_MS, totalMs: BURST_FLIGHT_MS + (count - 1) * 45 };
}

export interface PlayBurstOptions {
  from: Element | null;
  to: Element | null;
  amount: number;
  seed?: number;
  powerSave?: boolean;
  /** Skip the show (reduced motion). */
  reducedMotion?: boolean;
  /** Called once per piece that lands, with how many have landed so far. */
  onLand?: (landed: number, total: number) => void;
  /** Called once when everything has landed (or immediately when the show is skipped). */
  onDone?: () => void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function makePiece(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.setAttribute('aria-hidden', 'true');
  wrap.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;z-index:70;pointer-events:none;color:hsl(var(--primary, 45 100% 55%))';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', LOK_GLYPH_PATHS.coin);
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('fill-rule', 'evenodd');
  svg.appendChild(path);
  wrap.appendChild(svg);
  return wrap;
}

/** Play the burst. Returns a cancel function that removes any pieces still flying (call it on unmount). */
export function playCollectBurst(opts: PlayBurstOptions): () => void {
  const skip = opts.reducedMotion || !opts.from || !opts.to || typeof document === 'undefined' || document.hidden;
  const plan = planBurst({ amount: opts.amount, seed: opts.seed ?? 616, powerSave: opts.powerSave });
  const total = plan.pieces.length;
  if (skip) {
    opts.onLand?.(total, total);
    opts.onDone?.();
    return () => {};
  }
  const fr = opts.from!.getBoundingClientRect();
  const tr = opts.to!.getBoundingClientRect();
  const fx = fr.left + fr.width / 2;
  const fy = fr.top + fr.height / 2;
  const tx = tr.left + tr.width / 2;
  const ty = tr.top + tr.height / 2;
  const els: HTMLElement[] = [];
  let landed = 0;
  let cancelled = false;
  plan.pieces.forEach((p) => {
    const el = makePiece();
    document.body.appendChild(el);
    els.push(el);
    const at = (x: number, y: number, scale: number, rot: number) => `translate(${x}px,${y}px) translate(-50%,-50%) scale(${scale}) rotate(${rot}deg)`;
    const anim = el.animate(
      [
        { transform: at(fx, fy, 0.2, 0), opacity: 0 },
        { transform: at(fx + p.dx, fy + p.dy, 1.1, p.spin * 0.35), opacity: 1, offset: 0.3 },
        { transform: at(fx + p.dx, fy + p.dy, 1, p.spin * 0.6), opacity: 1, offset: 0.55 },
        { transform: at(tx, ty, 0.5, p.spin), opacity: 1 },
      ],
      { duration: plan.flightMs, delay: p.delayMs, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' },
    );
    anim.onfinish = () => {
      el.remove();
      if (cancelled) return;
      landed += 1;
      opts.onLand?.(landed, total);
      if (landed === total) opts.onDone?.();
    };
  });
  return () => {
    cancelled = true;
    els.forEach((el) => el.remove());
  };
}
