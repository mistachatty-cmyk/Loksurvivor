/**
 * Controller support for browsers on consoles (and any pad on desktop).
 *
 * Xbox Edge starts in "mouse mode": the left stick drags a cursor and A clicks,
 * which our touch joystick reads as a drag that can stick. We opt out where the
 * browser allows it, and drive menus from the pad ourselves.
 *
 * Self-contained so other Lok games can copy this file as is.
 */

export const isConsoleBrowser = typeof navigator !== 'undefined' && /Xbox|PlayStation|Nintendo/i.test(navigator.userAgent);

let gameplay = false;
/** While true the game reads the pad itself and menu navigation stays out of the way. */
export function setPadGameplay(active: boolean): void { gameplay = active; }

/** The connected pad to read: a standard-mapped one wins, then the most recently used. */
export function activePad(): Gamepad | null {
  const pads = Array.from(navigator.getGamepads?.() ?? []).filter((p): p is Gamepad => Boolean(p?.connected));
  pads.sort((a, b) => Number(b.mapping === 'standard') - Number(a.mapping === 'standard') || b.timestamp - a.timestamp);
  return pads[0] ?? null;
}

export type Direction = 'up' | 'down' | 'left' | 'right';
export interface Box { x: number; y: number }

/** Index of the nearest centre in a direction, or -1. Sideways offset counts double. */
export function nextInDirection(from: Box, to: readonly Box[], dir: Direction): number {
  let best = -1;
  let bestScore = Infinity;
  to.forEach((box, i) => {
    const dx = box.x - from.x;
    const dy = box.y - from.y;
    const ahead = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
    if (ahead <= 4) return;
    const score = ahead + 2 * Math.abs(dir === 'left' || dir === 'right' ? dy : dx);
    if (score < bestScore) { bestScore = score; best = i; }
  });
  return best;
}

const FOCUSABLE = 'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[role="button"],[tabindex]:not([tabindex="-1"])';

function targets(): HTMLElement[] {
  const modals = document.querySelectorAll<HTMLElement>('[aria-modal="true"]');
  const root: ParentNode = modals[modals.length - 1] ?? document;
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    if (el.closest('[inert],[aria-hidden="true"]')) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    // Skip anything covered by an overlay (only testable while on screen).
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return true;
    const hit = document.elementFromPoint(x, y);
    return !hit || el.contains(hit) || hit.contains(el);
  });
}

const centre = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

function focusOn(el: HTMLElement): void {
  document.documentElement.dataset.padNav = 'on';
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/** Where focus starts: the biggest control on screen, which is the screen's main action. */
function primary(items: HTMLElement[]): HTMLElement {
  const area = (el: Element) => { const r = el.getBoundingClientRect(); return r.width * r.height; };
  return items.reduce((a, b) => (area(b) > area(a) ? b : a));
}

function move(dir: Direction): void {
  const items = targets();
  if (items.length === 0) return;
  const current = document.activeElement as HTMLElement | null;
  if (!current || !items.includes(current)) { focusOn(primary(items)); return; }
  if (current instanceof HTMLInputElement && current.type === 'range' && (dir === 'left' || dir === 'right')) {
    const before = current.value;
    if (dir === 'right') current.stepUp(); else current.stepDown();
    if (current.value !== before) {
      // React listens through the native setter, so write through it.
      const next = current.value;
      current.value = before;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(current, next);
      current.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return;
  }
  const others = items.filter((el) => el !== current);
  const index = nextInDirection(centre(current), others.map(centre), dir);
  if (index >= 0) focusOn(others[index]!);
}

function press(): void {
  const current = document.activeElement as HTMLElement | null;
  const items = targets();
  if (current && items.includes(current)) current.click();
  else if (items[0]) focusOn(primary(items));
}

/** Back or close buttons, for screens that do not listen for Escape. */
const BACK = '[data-testid="button-back"],[data-testid$="-back"],[data-testid^="button-close"]';

function back(): void {
  const button = targets().find((el) => el.matches(BACK));
  if (button) { button.click(); return; }
  escape();
}

function escape(): void {
  const el = document.activeElement ?? document.body;
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
}

/** Right stick scrolls whatever holds the focused control, or the page. */
function scroll(amount: number): void {
  let el = document.activeElement as HTMLElement | null;
  while (el && !(el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
  if (el) el.scrollTop += amount;
  else window.scrollBy(0, amount);
}

const REPEAT_FIRST_MS = 380;
const REPEAT_MS = 130;

export function installConsolePad(enabled: () => boolean): void {
  const nav = navigator as Navigator & { gamepadInputEmulation?: string };
  if ('gamepadInputEmulation' in nav || isConsoleBrowser) nav.gamepadInputEmulation = 'gamepad';
  // Console browsers also send VK_GAMEPAD_* key events; stop them scrolling the page.
  window.addEventListener('keydown', (e) => { if (e.keyCode >= 195 && e.keyCode <= 218) e.preventDefault(); }, true);
  window.addEventListener('pointerdown', () => { delete document.documentElement.dataset.padNav; }, true);

  const style = document.createElement('style');
  style.textContent = 'html[data-pad-nav] :focus{outline:3px solid #67e8f9!important;outline-offset:2px}';
  document.head.appendChild(style);

  const held = new Map<string, number>(); // input name -> time it may fire again
  let raf = 0;
  const poll = (time: number) => {
    const pad = activePad();
    if (!pad) { raf = 0; held.clear(); return; }
    raf = requestAnimationFrame(poll);
    const down = (i: number) => Boolean(pad.buttons[i]?.pressed);
    const [x = 0, y = 0] = pad.axes;
    const rightY = pad.axes[3] ?? 0;
    if (!gameplay && enabled() && Math.abs(rightY) > 0.3) scroll(rightY * 18);
    const inputs: [string, boolean, () => void, boolean][] = [
      ['up', down(12) || y < -0.6, () => move('up'), true],
      ['down', down(13) || y > 0.6, () => move('down'), true],
      ['left', down(14) || x < -0.6, () => move('left'), true],
      ['right', down(15) || x > 0.6, () => move('right'), true],
      ['a', down(0), press, false],
      ['b', down(1), back, false],
      ['start', down(9), escape, false],
    ];
    for (const [name, on, run, repeats] of inputs) {
      if (!on) { held.delete(name); continue; }
      const due = held.get(name);
      if (due !== undefined && (!repeats || time < due)) continue;
      held.set(name, time + (due === undefined ? REPEAT_FIRST_MS : REPEAT_MS));
      // Held state is tracked during play too, so a button held into a menu does not fire there.
      if (!gameplay && enabled()) run();
    }
  };
  const start = () => { if (!raf) raf = requestAnimationFrame(poll); };
  window.addEventListener('gamepadconnected', start);
  if (activePad()) start();
}
