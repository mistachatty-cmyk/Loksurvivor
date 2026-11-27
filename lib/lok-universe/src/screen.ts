// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
/**
 * Lok screen: the baseline fullscreen and pop-out control every Lok game and app carries.
 *
 * A small corners-only square that fades to near see-through when you are not using it. Tap it and
 * the game goes fullscreen (on any device that allows it), or pops out into its own floating window
 * you can drag anywhere, keep on top, and move your mouse away from. Players choose the mode and where
 * the button sits (any corner, next to the game's own menu, or hidden) in the game's settings; the
 * choice is shared by every Lok app on the same site.
 *
 * Pop-out uses Document Picture-in-Picture (Chrome and Edge on desktop): the game's own page moves into
 * the floating window, so it keeps running with the same save. Elsewhere it opens a separate window.
 * Phones that cannot pop out go fullscreen instead; iPhone Safari, which has no page fullscreen, gets a
 * one-line hint to add the game to the Home Screen.
 *
 * Framework-free DOM; pure helpers are exported for tests. Labels are English defaults; pass your
 * game's translations.
 */

export type ScreenButtonPlace = "top-right" | "top-left" | "bottom-right" | "bottom-left" | "with-menu" | "hidden";
export type ScreenMode = "fullscreen" | "popout";

export interface ScreenPrefs {
  place: ScreenButtonPlace;
  mode: ScreenMode;
  /** Fade the button to near see-through after a few idle seconds. */
  fade: boolean;
}

export const SCREEN_PREFS_KEY = "lok.screen.v1";
export const SCREEN_PREFS_EVENT = "lokscreen:prefs";
/** Fired on window when the game leaves the main page (pop-out window) and when it comes back. */
export const SCREEN_AWAY_EVENT = "lokscreen:away";
export const SCREEN_BACK_EVENT = "lokscreen:back";

export const SCREEN_PLACES: ScreenButtonPlace[] = ["top-right", "top-left", "bottom-right", "bottom-left", "with-menu", "hidden"];
export const DEFAULT_SCREEN_PREFS: ScreenPrefs = { place: "top-right", mode: "fullscreen", fade: true };

export function normalizeScreenPrefs(raw: unknown): ScreenPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<ScreenPrefs>;
  return {
    place: SCREEN_PLACES.includes(r.place as ScreenButtonPlace) ? (r.place as ScreenButtonPlace) : DEFAULT_SCREEN_PREFS.place,
    mode: r.mode === "popout" || r.mode === "fullscreen" ? r.mode : DEFAULT_SCREEN_PREFS.mode,
    fade: typeof r.fade === "boolean" ? r.fade : DEFAULT_SCREEN_PREFS.fade,
  };
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;
const store = (): StorageLike | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

export function readScreenPrefs(storage: StorageLike | null = store()): ScreenPrefs {
  try {
    return normalizeScreenPrefs(JSON.parse(storage?.getItem(SCREEN_PREFS_KEY) ?? "null"));
  } catch {
    return { ...DEFAULT_SCREEN_PREFS };
  }
}

export function writeScreenPrefs(next: Partial<ScreenPrefs>, storage: StorageLike | null = store()): ScreenPrefs {
  const merged = normalizeScreenPrefs({ ...readScreenPrefs(storage), ...next });
  try {
    storage?.setItem(SCREEN_PREFS_KEY, JSON.stringify(merged));
  } catch {
    // Private mode or full storage: the choice lasts this visit only.
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(SCREEN_PREFS_EVENT, { detail: merged }));
  return merged;
}

export interface ScreenEnv {
  fullscreenEnabled: boolean;
  documentPip: boolean;
  canOpenWindows: boolean;
  phone: boolean;
  iosSafari: boolean;
}

export interface ScreenSupport {
  fullscreen: boolean;
  popout: "document-pip" | "window" | "none";
  /** iPhone: no page fullscreen; Add to Home Screen is the way. */
  homeScreenHint: boolean;
}

export function screenSupport(env: ScreenEnv): ScreenSupport {
  return {
    fullscreen: env.fullscreenEnabled,
    popout: env.documentPip ? "document-pip" : env.canOpenWindows && !env.phone ? "window" : "none",
    homeScreenHint: env.iosSafari && !env.fullscreenEnabled,
  };
}

export type ScreenAction = "enter-fullscreen" | "exit-fullscreen" | "popout" | "return" | "home-screen-hint" | "none";

/** What one press of the button does, given the chosen mode, what the device can do, and the current state. */
export function screenAction(mode: ScreenMode, support: ScreenSupport, state: { fullscreen: boolean; poppedOut: boolean }): ScreenAction {
  if (state.poppedOut) return "return";
  if (state.fullscreen) return "exit-fullscreen";
  if (mode === "popout" && support.popout !== "none") return "popout";
  if (support.fullscreen) return "enter-fullscreen";
  if (support.homeScreenHint) return "home-screen-hint";
  return "none";
}

export function detectScreenEnv(): ScreenEnv {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const doc = typeof document === "undefined" ? null : (document as Document & { webkitFullscreenEnabled?: boolean });
  const phone = /iPhone|iPod|Android.+Mobile|Mobile Safari/i.test(ua);
  const ios = /iPhone|iPod/i.test(ua);
  return {
    fullscreenEnabled: !!doc && !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled),
    documentPip: typeof window !== "undefined" && "documentPictureInPicture" in window,
    canOpenWindows: typeof window !== "undefined" && typeof window.open === "function",
    phone,
    iosSafari: ios && !/CriOS|FxiOS|EdgiOS/i.test(ua),
  };
}

type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

export function isFullscreen(): boolean {
  if (typeof document === "undefined") return false;
  const d = document as FsDoc;
  return !!(d.fullscreenElement || d.webkitFullscreenElement);
}

/** Must be called from a tap, click or key press: browsers only allow fullscreen from a user gesture. */
export async function enterFullscreen(el: HTMLElement = document.documentElement): Promise<boolean> {
  const e = el as FsEl;
  try {
    if (e.requestFullscreen) await e.requestFullscreen({ navigationUI: "hide" });
    else if (e.webkitRequestFullscreen) await e.webkitRequestFullscreen();
    else return false;
    return true;
  } catch {
    return false;
  }
}

export async function exitFullscreen(): Promise<void> {
  const d = document as FsDoc;
  try {
    if (d.exitFullscreen && d.fullscreenElement) await d.exitFullscreen();
    else if (d.webkitExitFullscreen) await d.webkitExitFullscreen();
  } catch {
    // Already out.
  }
}

// ---------------------------------------------------------------------------------------------
// Pop-out

interface PopState {
  kind: "pip" | "window";
  win: Window;
  restore: () => void;
}
let popped: PopState | null = null;

export function isPoppedOut(): boolean {
  return !!popped && !popped.win.closed;
}

/** How the game is popped out right now: a floating window of this page, a separate window, or not at all. */
export function popoutKind(): "pip" | "window" | null {
  return isPoppedOut() ? popped!.kind : null;
}

/** The pop-out window while it is open: games read input and timers from it if they need to. */
export function popoutWindow(): Window | null {
  return isPoppedOut() ? popped!.win : null;
}

export interface PopOutOptions {
  /** The element that holds the game (React's root). Default: #root, else the body's first element. */
  root?: HTMLElement | null;
  width?: number;
  height?: number;
  labels?: Partial<ScreenLabels>;
}

function copyStyles(to: Document) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules).map((r) => r.cssText).join("\n");
      const s = to.createElement("style");
      s.textContent = css;
      to.head.append(s);
    } catch {
      if (sheet.href) {
        const l = to.createElement("link");
        l.rel = "stylesheet";
        l.href = sheet.href;
        to.head.append(l);
      }
    }
  }
  for (const a of Array.from(document.documentElement.attributes)) to.documentElement.setAttribute(a.name, a.value);
  to.body.className = document.body.className;
  to.body.style.cssText = document.body.style.cssText + ";margin:0;overflow:hidden;";
}

function placeholder(labels: ScreenLabels, onBack: () => void): HTMLElement {
  const box = document.createElement("div");
  box.setAttribute("data-lok-screen-placeholder", "");
  box.style.cssText = "position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#07061a;color:#fff;font:600 16px system-ui,sans-serif;text-align:center;padding:24px;z-index:2147483000";
  const p = document.createElement("p");
  p.textContent = labels.poppedOut;
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = labels.bringBack;
  b.style.cssText = "min-height:44px;padding:0 18px;border:2px solid #38f2ff;background:transparent;color:#38f2ff;font:800 14px system-ui,sans-serif;cursor:pointer";
  b.addEventListener("click", onBack);
  box.append(p, b);
  return box;
}

/** Must be called from a tap or click. Returns how the game popped out, or "failed". */
export async function popOut(opts: PopOutOptions = {}): Promise<"pip" | "window" | "failed"> {
  if (isPoppedOut()) return popped!.kind;
  const labels = { ...DEFAULT_SCREEN_LABELS, ...opts.labels };
  const width = opts.width ?? Math.min(960, Math.round(window.innerWidth * 0.6));
  const height = opts.height ?? Math.min(720, Math.round(window.innerHeight * 0.7));
  const pipApi = (window as Window & { documentPictureInPicture?: { requestWindow(o: { width: number; height: number }): Promise<Window> } }).documentPictureInPicture;

  if (pipApi) {
    const root = opts.root ?? document.getElementById("root") ?? (document.body.firstElementChild as HTMLElement | null);
    if (!root) return "failed";
    let pip: Window;
    try {
      pip = await pipApi.requestWindow({ width, height });
    } catch {
      return "failed";
    }
    copyStyles(pip.document);
    const parent = root.parentNode!;
    const holder = placeholder(labels, () => returnFromPopout());
    parent.insertBefore(holder, root);
    pip.document.body.append(root);
    // Games listen on the main window: forward keys and size changes, and run frames off the
    // pop-out window so the game keeps going when the main tab is hidden.
    const forward = (e: Event) => window.dispatchEvent(new (e.constructor as typeof Event)(e.type, e));
    const keys = ["keydown", "keyup"];
    keys.forEach((k) => pip.addEventListener(k, forward));
    const onResize = () => window.dispatchEvent(new Event("resize"));
    pip.addEventListener("resize", onResize);
    const raf = window.requestAnimationFrame;
    const caf = window.cancelAnimationFrame;
    window.requestAnimationFrame = (cb) => pip.requestAnimationFrame(cb);
    window.cancelAnimationFrame = (id) => pip.cancelAnimationFrame(id);
    const restore = () => {
      window.requestAnimationFrame = raf;
      window.cancelAnimationFrame = caf;
      keys.forEach((k) => pip.removeEventListener(k, forward));
      pip.removeEventListener("resize", onResize);
      if (holder.parentNode) {
        holder.parentNode.insertBefore(root, holder);
        holder.remove();
      }
      popped = null;
      window.dispatchEvent(new Event(SCREEN_BACK_EVENT));
      window.dispatchEvent(new Event("resize"));
    };
    pip.addEventListener("pagehide", restore, { once: true });
    popped = { kind: "pip", win: pip, restore };
    window.dispatchEvent(new Event(SCREEN_AWAY_EVENT));
    setTimeout(onResize, 0);
    return "pip";
  }

  const win = window.open(window.location.href, "lok-popout", `popup,width=${width},height=${height}`);
  if (!win) return "failed";
  const holder = placeholder(labels, () => returnFromPopout());
  document.body.append(holder);
  // The page here stops making sound; games pause on this event too.
  document.querySelectorAll("audio,video").forEach((m) => (m as HTMLMediaElement).pause());
  const timer = window.setInterval(() => {
    if (win.closed) restoreWindow();
  }, 800);
  const restoreWindow = () => {
    window.clearInterval(timer);
    holder.remove();
    popped = null;
    window.dispatchEvent(new Event(SCREEN_BACK_EVENT));
  };
  popped = { kind: "window", win, restore: restoreWindow };
  window.dispatchEvent(new Event(SCREEN_AWAY_EVENT));
  return "window";
}

export function returnFromPopout(): void {
  if (!popped) return;
  const p = popped;
  try {
    p.win.close();
  } catch {
    // Closed already.
  }
  p.restore();
}

// ---------------------------------------------------------------------------------------------
// The button

export interface ScreenLabels {
  enterFullscreen: string;
  exitFullscreen: string;
  popOut: string;
  bringBack: string;
  poppedOut: string;
  homeScreenHint: string;
  notAllowed: string;
}

export const DEFAULT_SCREEN_LABELS: ScreenLabels = {
  enterFullscreen: "Full screen",
  exitFullscreen: "Leave full screen",
  popOut: "Pop out into its own window",
  bringBack: "Bring it back here",
  poppedOut: "The game is playing in its own window.",
  homeScreenHint: "On iPhone, use Share, then Add to Home Screen, to play full screen.",
  notAllowed: "This browser did not allow it. Try its own full screen command.",
};

/** Corners-only square, drawn here (original art). In: corners point out. Out: corners point in. Pop-out: corners plus a small window. */
export function screenGlyph(kind: "enter" | "exit" | "popout" | "return"): string {
  const s = 'fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="square"';
  const corners =
    kind === "exit" || kind === "return"
      ? `<path ${s} d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6"/>`
      : `<path ${s} d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6"/>`;
  const win = kind === "popout" ? '<rect x="11" y="11" width="7" height="5" fill="currentColor"/>' : "";
  return `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">${corners}${win}</svg>`;
}

export function placeStyle(place: ScreenButtonPlace, inset = 10): string {
  const v = `max(${inset}px, env(safe-area-inset-top))`;
  const b = `max(${inset}px, env(safe-area-inset-bottom))`;
  const l = `max(${inset}px, env(safe-area-inset-left))`;
  const r = `max(${inset}px, env(safe-area-inset-right))`;
  switch (place) {
    case "top-left":
      return `top:${v};left:${l};`;
    case "bottom-right":
      return `bottom:${b};right:${r};`;
    case "bottom-left":
      return `bottom:${b};left:${l};`;
    default:
      return `top:${v};right:${r};`;
  }
}

export interface ScreenButtonOptions {
  labels?: Partial<ScreenLabels>;
  /** The element to pop out. Default: #root. */
  root?: HTMLElement | null;
  /** Where "with-menu" puts the button (the game's nav or menu bar). Default: the first element marked
   * data-lok-menu-anchor. Falls back to top-right when there is none on screen. */
  anchor?: () => HTMLElement | null;
  zIndex?: number;
  /** Milliseconds of no input before the button fades. */
  idleMs?: number;
  /** Faded opacity, 0..1. */
  fadedOpacity?: number;
  /** Shown to the player when something is not possible here (hint or refusal). */
  notify?: (message: string) => void;
}

export interface ScreenButtonHandle {
  refresh(): void;
  destroy(): void;
  press(): Promise<void>;
}

const STYLE_ID = "lok-screen-style";
function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
.lok-screen-btn{position:fixed;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:10px;border:0;background:rgba(7,6,26,.55);color:#fff;cursor:pointer;opacity:.9;transition:opacity 1.2s ease,transform .12s ease,background .2s ease;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.lok-screen-btn.inline{position:static}
.lok-screen-btn.idle{opacity:var(--lok-screen-faded,.22)}
.lok-screen-btn:hover,.lok-screen-btn:focus-visible{opacity:1;background:rgba(7,6,26,.8);transition:opacity .15s ease}
.lok-screen-btn:focus-visible{outline:3px solid #ffd23f;outline-offset:2px}
.lok-screen-btn:active{transform:scale(.9)}
.lok-screen-btn[aria-busy="true"]{opacity:.5;cursor:progress}
@media (prefers-reduced-motion: reduce){.lok-screen-btn{transition:none}}
`;
  document.head.append(s);
}

/** Adds the fullscreen / pop-out button to the page and keeps it in step with the saved choice. */
export function mountScreenButton(opts: ScreenButtonOptions = {}): ScreenButtonHandle {
  injectStyle();
  const labels = { ...DEFAULT_SCREEN_LABELS, ...opts.labels };
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "lok-screen-btn";
  btn.setAttribute("data-lok-screen", "");
  btn.style.zIndex = String(opts.zIndex ?? 2147482000);
  btn.style.setProperty("--lok-screen-faded", String(opts.fadedOpacity ?? 0.22));
  let idleTimer = 0;
  const idleMs = opts.idleMs ?? 2600;

  const wake = () => {
    btn.classList.remove("idle");
    window.clearTimeout(idleTimer);
    if (readScreenPrefs().fade) idleTimer = window.setTimeout(() => btn.classList.add("idle"), idleMs);
  };

  const refresh = () => {
    const prefs = readScreenPrefs();
    const support = screenSupport(detectScreenEnv());
    const action = screenAction(prefs.mode, support, { fullscreen: isFullscreen(), poppedOut: isPoppedOut() });
    const kind = action === "exit-fullscreen" ? "exit" : action === "return" ? "return" : action === "popout" ? "popout" : "enter";
    btn.innerHTML = screenGlyph(kind);
    const label = action === "exit-fullscreen" ? labels.exitFullscreen : action === "return" ? labels.bringBack : action === "popout" ? labels.popOut : labels.enterFullscreen;
    btn.setAttribute("aria-label", label);
    btn.title = label;
    btn.hidden = prefs.place === "hidden" || action === "none";
    const anchor = prefs.place === "with-menu" ? (opts.anchor ?? (() => document.querySelector<HTMLElement>("[data-lok-menu-anchor]")))() : null;
    if (anchor) {
      btn.classList.add("inline");
      btn.style.cssText = `z-index:${btn.style.zIndex};--lok-screen-faded:${opts.fadedOpacity ?? 0.22}`;
      if (btn.parentElement !== anchor) anchor.append(btn);
    } else {
      btn.classList.remove("inline");
      btn.style.cssText = `${placeStyle(prefs.place === "with-menu" ? "top-right" : prefs.place)}z-index:${opts.zIndex ?? 2147482000};--lok-screen-faded:${opts.fadedOpacity ?? 0.22}`;
      if (btn.parentElement !== document.body) document.body.append(btn);
    }
    wake();
  };

  const press = async () => {
    const prefs = readScreenPrefs();
    const support = screenSupport(detectScreenEnv());
    const action = screenAction(prefs.mode, support, { fullscreen: isFullscreen(), poppedOut: isPoppedOut() });
    btn.setAttribute("aria-busy", "true");
    try {
      if (action === "enter-fullscreen") {
        if (!(await enterFullscreen())) opts.notify?.(labels.notAllowed);
      } else if (action === "exit-fullscreen") await exitFullscreen();
      else if (action === "popout") {
        const how = await popOut({ root: opts.root, labels });
        if (how === "failed" && support.fullscreen && !(await enterFullscreen())) opts.notify?.(labels.notAllowed);
      } else if (action === "return") returnFromPopout();
      else if (action === "home-screen-hint") opts.notify?.(labels.homeScreenHint);
    } finally {
      btn.removeAttribute("aria-busy");
      refresh();
    }
  };

  btn.addEventListener("click", () => void press());
  const activity = ["pointermove", "pointerdown", "keydown", "touchstart"];
  activity.forEach((e) => window.addEventListener(e, wake, { passive: true }));
  const events = ["fullscreenchange", "webkitfullscreenchange"];
  events.forEach((e) => document.addEventListener(e, refresh));
  window.addEventListener(SCREEN_PREFS_EVENT, refresh);
  window.addEventListener(SCREEN_BACK_EVENT, refresh);
  window.addEventListener(SCREEN_AWAY_EVENT, refresh);
  const onStorage = (e: StorageEvent) => {
    if (e.key === SCREEN_PREFS_KEY) refresh();
  };
  window.addEventListener("storage", onStorage);
  refresh();

  return {
    refresh,
    press,
    destroy() {
      window.clearTimeout(idleTimer);
      activity.forEach((e) => window.removeEventListener(e, wake));
      events.forEach((e) => document.removeEventListener(e, refresh));
      window.removeEventListener(SCREEN_PREFS_EVENT, refresh);
      window.removeEventListener(SCREEN_BACK_EVENT, refresh);
      window.removeEventListener(SCREEN_AWAY_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
      btn.remove();
    },
  };
}
