// The bouncing Bible (docs/183): a small book that drifts around the screen like a DVD logo, carrying a verse. Optional and opt-in.
// Tap it to read the verse; Pause, Stop and Remind me later are on the card. It never appears mid-battle and holds still under Reduced motion.
import { SEED_REFS, verseOf, type Verse } from './lokabiblio';
import { loadFaith } from './faithStore';

export const EVERY_MIN = [5, 10, 15, 30, 60] as const;
export const STAY_SEC = [15, 30, 60, 0] as const;           // 0 = until you tap it or stop it
export const SPEED_PX: Record<'slow' | 'normal' | 'fast', number> = { slow: 45, normal: 80, fast: 130 };
export interface Mover { x: number; y: number; vx: number; vy: number }
export interface Field { w: number; h: number; size: number; top: number }   // play area, book size, space kept clear at the top

/** One movement step with bounces off the four walls. Pure, so it is tested without a screen. */
export function stepMover(m: Mover, f: Field, dt: number): Mover {
  let { x, y, vx, vy } = m; x += vx * dt; y += vy * dt;
  const maxX = Math.max(0, f.w - f.size), minY = f.top, maxY = Math.max(minY, f.h - f.size);
  if (x < 0) { x = -x; vx = Math.abs(vx); } else if (x > maxX) { x = 2 * maxX - x; vx = -Math.abs(vx); }
  if (y < minY) { y = 2 * minY - y; vy = Math.abs(vy); } else if (y > maxY) { y = 2 * maxY - y; vy = -Math.abs(vy); }
  return { x: Math.min(maxX, Math.max(0, x)), y: Math.min(maxY, Math.max(minY, y)), vx, vy };
}
/** A starting direction at the given speed, from a random number 0 to 1 (kept away from straight lines so it wanders the whole screen). */
export function startVelocity(speed: number, rnd: number): { vx: number; vy: number } {
  const a = (0.2 + 0.6 * rnd) * (Math.PI / 2) + Math.floor(rnd * 4) * (Math.PI / 2);   // never within 0.2 rad of an axis
  return { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed };
}
/** Which verse to carry: your bookmarks when asked and any exist, otherwise one at random from the seed set. */
export function pickBounceVerse(source: 'random' | 'saved', rnd: number, marks: string[], lookup: (ref: string) => Verse | null = verseOf, names: readonly string[] = []): Verse | null {
  if (source === 'saved' && marks.length && names.length) {
    const [b, c, v] = marks[Math.min(marks.length - 1, Math.floor(rnd * marks.length))].split(':').map(Number);
    const hit = lookup(`${names[b - 1]} ${c}:${v}`); if (hit) return hit;
  }
  return lookup(SEED_REFS[Math.min(SEED_REFS.length - 1, Math.floor(rnd * SEED_REFS.length))]);
}

// The book is drawn in code: a closed Bible with a gold cross on a deep blue cover, page edges and a ribbon. Original art.
const BOOK_SVG = `<svg viewBox="0 0 64 80" width="100%" height="100%" aria-hidden="true" focusable="false"><defs><linearGradient id="fbc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1b2a63"/><stop offset=".12" stop-color="#2d4192"/><stop offset="1" stop-color="#1d2c6e"/></linearGradient><linearGradient id="fbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2c9"/><stop offset="1" stop-color="#d8a63c"/></linearGradient></defs><rect x="8" y="6" width="50" height="68" rx="4" fill="#efe3c0"/><rect x="6" y="4" width="50" height="68" rx="4" fill="url(#fbc)" stroke="#f1d27a" stroke-width="1.5"/><rect x="6" y="4" width="7" height="68" rx="3" fill="#0f1a45" opacity=".6"/><path d="M33 17h4v13h10v4H37v22h-4V34H23v-4h10Z" fill="url(#fbg)"/><rect x="11" y="58" width="40" height="1.5" fill="#f1d27a" opacity=".7"/><path d="M46 72v10l4-3 4 3V72Z" fill="#b2332f"/></svg>`;

export interface BounceCtl { stop(): void; pause(on: boolean): void; readonly el: HTMLElement }
/** Show the bouncing book now. `onTap` receives the verse and a handle to control the overlay (pause, stop). Returns null when one is already showing. */
export function showBounce(o: { verse: Verse; speed: 'slow' | 'normal' | 'fast'; staySec: number; reduced: boolean; onTap(v: Verse, ctl: BounceCtl): void; onEnd?(): void }): BounceCtl | null {
  if (document.querySelector('.fb-book')) return null;
  const size = 58, el = document.createElement('button'); el.type = 'button'; el.className = 'fb-book';
  el.setAttribute('aria-label', `Verse reminder, ${o.verse.ref}. Tap to read.`);
  el.innerHTML = `<span class="fb-art">${BOOK_SVG}</span><span class="fb-ref">${o.verse.ref.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>`;
  el.style.width = `${size}px`; document.body.appendChild(el);
  const field = (): Field => ({ w: innerWidth, h: innerHeight - 24, size: size + 14, top: o.reduced ? 0 : 76 });
  const f0 = field(); const v0 = startVelocity(SPEED_PX[o.speed], Math.random());
  let m: Mover = o.reduced ? { x: f0.w - size - 16, y: f0.h - size - 90, vx: 0, vy: 0 } : { x: Math.random() * (f0.w - size), y: f0.top + Math.random() * Math.max(1, f0.h - f0.top - size), ...v0 };
  let paused = false, raf = 0, last = 0, ended = false, timer = 0;
  const draw = (): void => { el.style.transform = `translate(${m.x.toFixed(1)}px,${m.y.toFixed(1)}px)`; };
  const tick = (t: number): void => { if (ended) return; const dt = Math.min(0.05, last ? (t - last) / 1000 : 0); last = t; if (!paused && !o.reduced && !document.hidden) { m = stepMover(m, field(), dt); draw(); } raf = requestAnimationFrame(tick); };
  const ctl: BounceCtl = {
    el, pause(on) { paused = on; el.classList.toggle('paused', on); },
    stop() { if (ended) return; ended = true; cancelAnimationFrame(raf); clearTimeout(timer); el.remove(); o.onEnd?.(); },
  };
  el.addEventListener('click', () => { ctl.pause(true); o.onTap(o.verse, ctl); });
  draw(); raf = requestAnimationFrame(tick);
  if (o.staySec > 0) timer = window.setTimeout(() => { if (!paused) ctl.stop(); else timer = window.setTimeout(() => ctl.stop(), 15000); }, o.staySec * 1000);
  return ctl;
}
export const markCount = (): number => loadFaith().marks.length;
