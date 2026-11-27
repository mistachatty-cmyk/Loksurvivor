/**
 * lokInput core -- one input layer for every Lok game: mouse/touch, keyboard and gamepad all become
 * the same small set of actions, so a game never asks "which device is this".
 *
 * EXTRACTION RULE: nothing in src/lib/lokInput imports from the rest of the game. It must stay
 * liftable into its own package (see docs/LOK_INPUT_PLAN.md). Text arrives through props; audio
 * arrives through a getter the host passes in.
 */

export type LokInputMode = 'pointer' | 'keyboard' | 'gamepad';
export const INPUT_MODES: readonly LokInputMode[] = ['pointer', 'keyboard', 'gamepad'];

/** What a game reacts to. Games never see key codes or button indices. */
export type LokAction =
  | { kind: 'dir'; dx: -1 | 0 | 1; dy: -1 | 0 | 1 }
  /** Space, Enter, gamepad A: confirm / roll / jump. */
  | { kind: 'primary' }
  /** N, Backspace, gamepad B: pass / back. (Esc is left to the browser so it can leave fullscreen.) */
  | { kind: 'secondary' }
  /** X key, gamepad X: the alternate (signature die, dash). */
  | { kind: 'tertiary' }
  /** Gamepad Y: spare. */
  | { kind: 'quaternary' }
  | { kind: 'num'; n: number };

export interface LokInputPrefs {
  mode: LokInputMode;
  /** Pad position as a fraction of the viewport (0..1), top-left of the pad. */
  x: number;
  y: number;
  locked: boolean;
}

export const DEFAULT_PREFS: LokInputPrefs = { mode: 'pointer', x: 0.012, y: 0.46, locked: false };
const STORE_KEY = 'lokinput.v1';

type ActionFn = (a: LokAction, source: Exclude<LokInputMode, 'pointer'>) => void;
type PrefsFn = (p: LokInputPrefs) => void;

const actionListeners = new Set<ActionFn>();
const prefsListeners = new Set<PrefsFn>();
let prefs: LokInputPrefs = load();
let started = false;

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function clamp01(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(0.97, Math.max(0, v)) : fallback;
}

export function sanitizePrefs(raw: unknown): LokInputPrefs {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<LokInputPrefs>;
  return {
    mode: INPUT_MODES.includes(o.mode as LokInputMode) ? (o.mode as LokInputMode) : DEFAULT_PREFS.mode,
    x: clamp01(o.x, DEFAULT_PREFS.x),
    y: clamp01(o.y, DEFAULT_PREFS.y),
    locked: o.locked === true,
  };
}

function load(): LokInputPrefs {
  try {
    const raw = storage()?.getItem(STORE_KEY);
    return sanitizePrefs(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function getPrefs(): LokInputPrefs {
  return prefs;
}

export function setPrefs(patch: Partial<LokInputPrefs>): void {
  prefs = sanitizePrefs({ ...prefs, ...patch });
  try {
    storage()?.setItem(STORE_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode: the pad just forgets */
  }
  prefsListeners.forEach((fn) => fn(prefs));
}

export function nextMode(m: LokInputMode): LokInputMode {
  return INPUT_MODES[(INPUT_MODES.indexOf(m) + 1) % INPUT_MODES.length];
}

export function onPrefs(fn: PrefsFn): () => void {
  prefsListeners.add(fn);
  return () => prefsListeners.delete(fn);
}

/** Subscribe to actions from keyboard and gamepad. Starts the listeners on first use. */
export function subscribeActions(fn: ActionFn): () => void {
  actionListeners.add(fn);
  start();
  return () => actionListeners.delete(fn);
}

function emit(a: LokAction, source: Exclude<LokInputMode, 'pointer'>): void {
  // Any real use of a device switches the pad to it: it catches whatever the player picked up.
  if (prefs.mode !== source) setPrefs({ mode: source });
  actionListeners.forEach((fn) => fn(a, source));
}

// ------------------------------------------------------------------ keyboard

const KEY_DIRS: Record<string, [-1 | 0 | 1, -1 | 0 | 1]> = {
  arrowleft: [-1, 0],
  a: [-1, 0],
  arrowright: [1, 0],
  d: [1, 0],
  arrowup: [0, -1],
  w: [0, -1],
  arrowdown: [0, 1],
  s: [0, 1],
};

/** Pure: one key to one action (or null). Esc is never mapped so browsers can leave fullscreen. */
export function actionForKey(key: string): LokAction | null {
  const k = key.toLowerCase();
  const d = KEY_DIRS[k];
  if (d) return { kind: 'dir', dx: d[0], dy: d[1] };
  if (k === 'enter' || k === ' ' || k === 'spacebar') return { kind: 'primary' };
  if (k === 'n' || k === 'backspace') return { kind: 'secondary' };
  if (k === 'x') return { kind: 'tertiary' };
  if (k === 'y') return { kind: 'quaternary' };
  if (/^[1-9]$/.test(k)) return { kind: 'num', n: Number(k) };
  return null;
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
  const el = e.target as HTMLElement | null;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
  const a = actionForKey(e.key);
  if (!a || actionListeners.size === 0) return;
  // Claim the key so focus never walks onto a browser overlay button, then drop stray focus.
  e.preventDefault();
  (document.activeElement as HTMLElement | null)?.blur?.();
  emit(a, 'keyboard');
}

// ------------------------------------------------------------------ gamepad

const DEAD = 0.55;
let padRaf = 0;
const padHeld = new Map<string, boolean>();

/** Pure: which actions a pad state fires, given what was held last frame. */
export function padActions(buttons: readonly boolean[], axes: readonly number[], held: Map<string, boolean>): LokAction[] {
  const out: LokAction[] = [];
  const edge = (id: string, down: boolean, make: () => LokAction) => {
    if (down && !held.get(id)) out.push(make());
    held.set(id, down);
  };
  const ax = axes[0] ?? 0;
  const ay = axes[1] ?? 0;
  edge('left', buttons[14] === true || ax < -DEAD, () => ({ kind: 'dir', dx: -1, dy: 0 }));
  edge('right', buttons[15] === true || ax > DEAD, () => ({ kind: 'dir', dx: 1, dy: 0 }));
  edge('up', buttons[12] === true || ay < -DEAD, () => ({ kind: 'dir', dx: 0, dy: -1 }));
  edge('down', buttons[13] === true || ay > DEAD, () => ({ kind: 'dir', dx: 0, dy: 1 }));
  edge('a', buttons[0] === true, () => ({ kind: 'primary' }));
  edge('b', buttons[1] === true, () => ({ kind: 'secondary' }));
  edge('x', buttons[2] === true, () => ({ kind: 'tertiary' }));
  edge('y', buttons[3] === true, () => ({ kind: 'quaternary' }));
  return out;
}

function pollPads(): void {
  padRaf = 0;
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
  let any = false;
  for (const pad of pads) {
    if (!pad || !pad.connected) continue;
    any = true;
    const fired = padActions(
      pad.buttons.map((b) => b.pressed),
      pad.axes,
      padHeld,
    );
    if (actionListeners.size) for (const a of fired) emit(a, 'gamepad');
  }
  if (any) padRaf = requestAnimationFrame(pollPads);
}

function startPads(): void {
  if (!padRaf) padRaf = requestAnimationFrame(pollPads);
}

function start(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('gamepadconnected', startPads);
  // A pad already plugged in is only reported after a button press; poll once to catch it.
  startPads();
}

/** Test and teardown hook. */
export function stopLokInput(): void {
  if (!started || typeof window === 'undefined') return;
  started = false;
  window.removeEventListener('keydown', onKeyDown, true);
  window.removeEventListener('gamepadconnected', startPads);
  if (padRaf) cancelAnimationFrame(padRaf);
  padRaf = 0;
}

// ------------------------------------------------------------------ feedback blip

/** A tiny, quiet pop for the pad button. Silent when the shared context is not running yet. */
export function popBlip(getContext: () => AudioContext | null, mode: LokInputMode): void {
  const ctx = getContext();
  if (!ctx || ctx.state !== 'running') return;
  const base = { pointer: 660, keyboard: 784, gamepad: 988 }[mode];
  const t = ctx.currentTime;
  for (const [i, mul] of [1, 1.5].entries()) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base * mul, t + i * 0.05);
    gain.gain.setValueAtTime(0.0001, t + i * 0.05);
    gain.gain.exponentialRampToValueAtTime(0.035, t + i * 0.05 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.05 + 0.11);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t + i * 0.05);
    osc.stop(t + i * 0.05 + 0.13);
  }
}
