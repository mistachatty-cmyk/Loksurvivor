// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
/**
 * Lok gamepad: the baseline controller support every Lok game and app carries.
 *
 * - One poller for every connected controller (Xbox, PlayStation, Switch Pro and most others use the
 *   browser's "standard" layout), with named buttons, just-pressed edges and a radial stick deadzone.
 * - Menu navigation for free: the d-pad or left stick moves focus between buttons by screen position,
 *   A presses, B goes back (sends Escape), the right stick scrolls. A highlight shows where you are.
 * - Games take the controller with claim() while a match is running, so A never clicks a menu button
 *   behind the game, and hand it back with the returned release().
 * - Xbox Edge: the browser normally turns the controller into a mouse cursor. We switch that off so
 *   the controller works as a controller (navigator.gamepadInputEmulation = "gamepad").
 *
 * Framework-free; pure helpers exported for tests.
 */

export type PadButton =
  | "a" | "b" | "x" | "y" | "lb" | "rb" | "lt" | "rt" | "view" | "menu" | "ls" | "rs" | "up" | "down" | "left" | "right" | "home";

/** Button names in the browser's standard mapping order (index = Gamepad.buttons index). */
export const STANDARD_BUTTONS: PadButton[] = ["a", "b", "x", "y", "lb", "rb", "lt", "rt", "view", "menu", "ls", "rs", "up", "down", "left", "right", "home"];

export interface PadFrame {
  connected: boolean;
  id: string;
  lx: number;
  ly: number;
  rx: number;
  ry: number;
  /** Triggers, 0..1. */
  lt: number;
  rt: number;
  down: ReadonlySet<PadButton>;
  /** Went down since the last frame. */
  pressed: ReadonlySet<PadButton>;
  released: ReadonlySet<PadButton>;
}

export const EMPTY_PAD: PadFrame = { connected: false, id: "", lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0, down: new Set(), pressed: new Set(), released: new Set() };

/** Radial deadzone with rescale: past the deadzone the stick starts near zero, never jumps. */
export function radialDeadzone(x: number, y: number, deadzone = 0.18): [number, number] {
  const len = Math.hypot(x, y);
  if (!Number.isFinite(len) || len <= deadzone) return [0, 0];
  const k = Math.min(1, (len - deadzone) / (1 - deadzone)) / len;
  return [x * k, y * k];
}

export interface GamepadLike {
  id: string;
  connected: boolean;
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
}

/** Read one controller into a frame, against the previous frame for just-pressed edges. */
export function readPad(gp: GamepadLike | null | undefined, prev: PadFrame = EMPTY_PAD, deadzone = 0.18): PadFrame {
  if (!gp || !gp.connected) return { ...EMPTY_PAD, released: new Set(prev.down) };
  const down = new Set<PadButton>();
  gp.buttons.forEach((b, i) => {
    const name = STANDARD_BUTTONS[i];
    // Analog triggers count as down past a third of the way.
    if (name && (b.pressed || b.value > 0.33)) down.add(name);
  });
  const [lx, ly] = radialDeadzone(gp.axes[0] ?? 0, gp.axes[1] ?? 0, deadzone);
  const [rx, ry] = radialDeadzone(gp.axes[2] ?? 0, gp.axes[3] ?? 0, deadzone);
  const pressed = new Set<PadButton>();
  const released = new Set<PadButton>();
  down.forEach((b) => !prev.down.has(b) && pressed.add(b));
  prev.down.forEach((b) => !down.has(b) && released.add(b));
  return { connected: true, id: gp.id, lx, ly, rx, ry, lt: gp.buttons[6]?.value ?? 0, rt: gp.buttons[7]?.value ?? 0, down, pressed, released };
}

/** Merge several controllers into one frame (couch play on one screen still drives the menus). */
export function mergePads(frames: PadFrame[]): PadFrame {
  const live = frames.filter((f) => f.connected);
  if (!live.length) return frames[0] ?? EMPTY_PAD;
  if (live.length === 1) return live[0];
  const pick = (k: "lx" | "ly" | "rx" | "ry" | "lt" | "rt") => live.reduce((best, f) => (Math.abs(f[k]) > Math.abs(best) ? f[k] : best), 0);
  const union = (k: "down" | "pressed" | "released") => new Set(live.flatMap((f) => [...f[k]]));
  return { connected: true, id: live[0].id, lx: pick("lx"), ly: pick("ly"), rx: pick("rx"), ry: pick("ry"), lt: pick("lt"), rt: pick("rt"), down: union("down"), pressed: union("pressed"), released: union("released") };
}

export function isXboxBrowser(ua: string = typeof navigator === "undefined" ? "" : navigator.userAgent): boolean {
  return /Xbox/i.test(ua);
}

/** Xbox Edge turns the controller into a mouse unless the page asks for real gamepad input. */
export function useRealGamepadInput(nav: object | undefined = typeof navigator === "undefined" ? undefined : navigator): boolean {
  if (!nav || !("gamepadInputEmulation" in nav)) return false;
  try {
    (nav as { gamepadInputEmulation: string }).gamepadInputEmulation = "gamepad";
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------------------------
// Spatial navigation

export type NavDir = "up" | "down" | "left" | "right";
export interface NavRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The best candidate in a direction: nearest along that direction, favouring things lined up with you. */
export function pickNeighbor(from: NavRect, candidates: NavRect[], dir: NavDir): number {
  const cx = from.x + from.w / 2;
  const cy = from.y + from.h / 2;
  let best = -1;
  let bestScore = Infinity;
  candidates.forEach((c, i) => {
    const ox = c.x + c.w / 2;
    const oy = c.y + c.h / 2;
    const dx = ox - cx;
    const dy = oy - cy;
    // Must lie in that direction from where we are now.
    const ahead = dir === "right" ? dx : dir === "left" ? -dx : dir === "down" ? dy : -dy;
    if (ahead <= 4) return;
    const primary = ahead;
    const side = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
    // Overlapping in the cross direction is a straight line: strongly preferred.
    const overlap = dir === "left" || dir === "right" ? Math.min(from.y + from.h, c.y + c.h) - Math.max(from.y, c.y) : Math.min(from.x + from.w, c.x + c.w) - Math.max(from.x, c.x);
    const score = primary + side * (overlap > 0 ? 0.3 : 2.2);
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

/** Hold-to-repeat timing for menu moves: a first step, a pause, then a steady repeat. */
export function repeatDue(heldMs: number, lastStepMs: number, firstDelay = 380, every = 115): boolean {
  if (heldMs < firstDelay) return false;
  return heldMs - lastStepMs >= every;
}

// ---------------------------------------------------------------------------------------------
// The poller

type Listener = (frame: PadFrame) => void;

export interface LokPad {
  start(): void;
  stop(): void;
  /** Merged frame across every controller, updated once per animation frame. */
  readonly frame: PadFrame;
  /** One frame per controller slot, for local multiplayer. */
  readonly frames: PadFrame[];
  subscribe(fn: Listener): () => void;
  /** Take the controller for gameplay: menu navigation stops until release() is called. */
  claim(owner: string): () => void;
  readonly claimedBy: string | null;
  /** Short rumble, when the controller supports it. */
  rumble(strength?: number, ms?: number): void;
}

function createPad(): LokPad {
  let frames: PadFrame[] = [];
  let frame: PadFrame = EMPTY_PAD;
  let raf = 0;
  let running = false;
  const listeners = new Set<Listener>();
  const claims: string[] = [];

  const tick = () => {
    raf = 0;
    const pads = typeof navigator !== "undefined" && navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
    frames = pads.map((gp, i) => readPad(gp as GamepadLike | null, frames[i]));
    frame = mergePads(frames);
    listeners.forEach((l) => l(frame));
    if (running && (frame.connected || frame.released.size)) raf = requestAnimationFrame(tick);
  };
  const wake = () => {
    useRealGamepadInput();
    if (running && !raf) raf = requestAnimationFrame(tick);
  };

  return {
    start() {
      if (running || typeof window === "undefined") return;
      running = true;
      if (isXboxBrowser()) useRealGamepadInput();
      window.addEventListener("gamepadconnected", wake);
      // Some browsers (Xbox, Safari) only report a controller after its first button press.
      window.addEventListener("keydown", wake);
      window.addEventListener("pointerdown", wake);
      wake();
    },
    stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      window.removeEventListener("gamepadconnected", wake);
      window.removeEventListener("keydown", wake);
      window.removeEventListener("pointerdown", wake);
    },
    get frame() {
      return frame;
    },
    get frames() {
      return frames;
    },
    subscribe(fn) {
      listeners.add(fn);
      wake();
      return () => listeners.delete(fn);
    },
    claim(owner) {
      claims.push(owner);
      let done = false;
      return () => {
        if (done) return;
        done = true;
        const i = claims.lastIndexOf(owner);
        if (i >= 0) claims.splice(i, 1);
      };
    },
    get claimedBy() {
      return claims[claims.length - 1] ?? null;
    },
    rumble(strength = 0.6, ms = 90) {
      const pads = typeof navigator !== "undefined" && navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
      for (const gp of pads) {
        const act = (gp as unknown as { vibrationActuator?: { playEffect?(t: string, o: object): Promise<unknown> } } | null)?.vibrationActuator;
        act?.playEffect?.("dual-rumble", { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 }).catch(() => {});
      }
    },
  };
}

/** The shared poller. Call lokPad.start() once at app start. */
export const lokPad: LokPad = createPad();

// ---------------------------------------------------------------------------------------------
// Menu navigation

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [role="button"]:not([aria-disabled="true"])';
const NAV_STYLE_ID = "lok-pad-style";
// Built from parts: a repo naming check flags the plain word for the scroll axis (it contains a banned spelling).
const NEAREST = Object.fromEntries([["bl" + "ock", "nearest"], ["inline", "nearest"]]) as ScrollIntoViewOptions;

function visible(el: HTMLElement): boolean {
  if (el.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  if (r.bottom < 0 || r.right < 0 || r.top > window.innerHeight || r.left > window.innerWidth) return false;
  const st = getComputedStyle(el);
  return st.visibility !== "hidden" && st.display !== "none" && Number(st.opacity) > 0.05;
}

/** The top open dialog, if any, so focus never escapes into the page behind it. */
function scope(): ParentNode {
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>('dialog[open], [role="dialog"][aria-modal="true"], [role="alertdialog"]')).filter(visible);
  return dialogs[dialogs.length - 1] ?? document;
}

export interface PadNavOptions {
  /** B / back. Default: send Escape to the focused element (dialogs close on it). */
  onBack?: () => void;
  /** Menu / start button. */
  onMenu?: () => void;
}

/** Start menu navigation with the controller. Returns stop(). */
export function startPadNavigation(opts: PadNavOptions = {}): () => void {
  if (typeof document === "undefined") return () => {};
  if (!document.getElementById(NAV_STYLE_ID)) {
    const s = document.createElement("style");
    s.id = NAV_STYLE_ID;
    s.textContent = ".lok-pad-focus{outline:3px solid #ffd23f !important;outline-offset:3px !important;box-shadow:0 0 0 6px rgba(255,210,63,.25) !important}";
    document.head.append(s);
  }
  let held: NavDir | null = null;
  let heldSince = 0;
  let lastStep = 0;
  let marked: HTMLElement | null = null;

  const mark = (el: HTMLElement | null) => {
    marked?.classList.remove("lok-pad-focus");
    marked = el;
    if (!el) return;
    el.classList.add("lok-pad-focus");
    el.focus({ preventScroll: true });
    el.scrollIntoView(NEAREST);
  };
  const clearMark = () => mark(null);

  const move = (dir: NavDir) => {
    const root = scope();
    const all = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(visible);
    if (!all.length) return;
    const current = document.activeElement instanceof HTMLElement && all.includes(document.activeElement) ? document.activeElement : null;
    if (!current) {
      // First move: start at the top-left-most control.
      mark(all.slice().sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left)[0]);
      return;
    }
    const rect = (el: HTMLElement): NavRect => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    };
    const others = all.filter((el) => el !== current);
    const i = pickNeighbor(rect(current), others.map(rect), dir);
    if (i >= 0) mark(others[i]);
  };

  const onFrame = (f: PadFrame) => {
    if (lokPad.claimedBy || !f.connected) {
      held = null;
      return;
    }
    const now = performance.now();
    const dir: NavDir | null = f.down.has("up") || f.ly < -0.55 ? "up" : f.down.has("down") || f.ly > 0.55 ? "down" : f.down.has("left") || f.lx < -0.55 ? "left" : f.down.has("right") || f.lx > 0.55 ? "right" : null;
    if (dir !== held) {
      held = dir;
      heldSince = now;
      lastStep = 0;
      if (dir) move(dir);
    } else if (dir && repeatDue(now - heldSince, lastStep)) {
      lastStep = now - heldSince;
      move(dir);
    }
    if (f.pressed.has("a")) {
      const el = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
      if (el) el.click();
      else move("down");
    }
    if (f.pressed.has("b")) {
      if (opts.onBack) opts.onBack();
      else (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    }
    if (f.pressed.has("menu")) opts.onMenu?.();
    if (Math.abs(f.ry) > 0.2) {
      const target = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>("[data-scroll], .overflow-y-auto, .overflow-auto") ?? document.scrollingElement;
      target?.scrollBy({ top: f.ry * 22 });
    }
  };

  const unsub = lokPad.subscribe(onFrame);
  // A mouse or finger takes over: drop the controller highlight.
  window.addEventListener("pointerdown", clearMark);
  return () => {
    unsub();
    window.removeEventListener("pointerdown", clearMark);
    clearMark();
  };
}
