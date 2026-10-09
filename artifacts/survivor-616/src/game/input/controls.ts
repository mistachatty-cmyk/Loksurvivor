/**
 * Player-chosen controls for keyboard + mouse, controller and touch.
 *
 * Everything here is pure except `getControls`/`saveControls`, which only touch
 * localStorage (device-local, like the other input settings). The run reads the
 * cached value each frame, so a change made in Settings applies immediately,
 * even from the pause menu.
 *
 * Movement keys (WASD / arrows) are fixed on purpose: rebinding them would let a
 * player lock themselves out of walking. Everything else can be remapped.
 */

export type ControlAction = 'dash' | 'ultimate' | 'interact' | 'pause' | 'zoom' | 'tactical';

export const CONTROL_ACTIONS: ControlAction[] = ['dash', 'ultimate', 'interact', 'pause', 'zoom', 'tactical'];

/** Keys that always move the player and so can never be bound to an action. */
export const RESERVED_KEYS: readonly string[] = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];

export interface ControlSettings {
  /** Lowercased `KeyboardEvent.key` per action. */
  keys: Record<ControlAction, string>;
  mouse: {
    /** Double-click the playfield to dash toward the pointer. */
    doubleClickDash: boolean;
  };
  gamepad: {
    enabled: boolean;
    /** 0.05 to 0.6, the radius of the stick's dead centre. */
    deadzone: number;
    /** Standard-mapping button index per action. */
    buttons: Record<ControlAction, number>;
  };
  touch: {
    /** Show the on-screen Dash button. */
    dashButton: boolean;
    /** Double-tap the playfield to dash toward the tap. */
    doubleTapDash: boolean;
  };
}

export const DEFAULT_CONTROLS: ControlSettings = {
  keys: { dash: 'shift', ultimate: ' ', interact: 'f', pause: 'escape', zoom: 'z', tactical: 'tab' },
  mouse: { doubleClickDash: true },
  gamepad: {
    enabled: true,
    deadzone: 0.2,
    // Standard layout: A, B, X, Y, LB, RB, LT, RT, Back, Start, L3, R3, d-pad.
    buttons: { interact: 0, dash: 1, ultimate: 2, zoom: 3, tactical: 8, pause: 9 },
  },
  touch: { dashButton: true, doubleTapDash: true },
};

export const CONTROL_LABELS: Record<ControlAction, string> = {
  dash: 'Dash',
  ultimate: 'Ultimate',
  interact: 'Interact',
  pause: 'Pause',
  zoom: 'Zoom',
  tactical: 'Tactical view',
};

export const GAMEPAD_BUTTON_NAMES: Record<number, string> = {
  0: 'A / Cross', 1: 'B / Circle', 2: 'X / Square', 3: 'Y / Triangle', 4: 'LB / L1', 5: 'RB / R1',
  6: 'LT / L2', 7: 'RT / R2', 8: 'Back / Select', 9: 'Start', 10: 'L3', 11: 'R3',
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A friendly name for a key, for the rebinding buttons. */
export function keyLabel(key: string): string {
  if (key === ' ') return 'Space';
  if (key === 'escape') return 'Esc';
  if (key.length === 1) return key.toUpperCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** Rebuilds a settings object from untrusted saved data, falling back per field. */
export function normalizeControls(raw: unknown): ControlSettings {
  const d = DEFAULT_CONTROLS;
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const keys = { ...d.keys };
  const used = new Set<string>();
  for (const action of CONTROL_ACTIONS) {
    const saved = r.keys?.[action];
    const ok = typeof saved === 'string' && saved.length > 0 && saved.length <= 12 && !RESERVED_KEYS.includes(saved) && !used.has(saved);
    keys[action] = ok ? saved : d.keys[action];
    used.add(keys[action]);
  }
  // A bad save must never leave two actions on one key.
  if (new Set(Object.values(keys)).size !== CONTROL_ACTIONS.length) Object.assign(keys, d.keys);

  const buttons = { ...d.gamepad.buttons };
  const usedButtons = new Set<number>();
  for (const action of CONTROL_ACTIONS) {
    const saved = r.gamepad?.buttons?.[action];
    const ok = Number.isInteger(saved) && saved >= 0 && saved <= 15 && !usedButtons.has(saved);
    buttons[action] = ok ? saved : d.gamepad.buttons[action];
    usedButtons.add(buttons[action]);
  }
  if (new Set(Object.values(buttons)).size !== CONTROL_ACTIONS.length) Object.assign(buttons, d.gamepad.buttons);

  return {
    keys,
    mouse: { doubleClickDash: typeof r.mouse?.doubleClickDash === 'boolean' ? r.mouse.doubleClickDash : d.mouse.doubleClickDash },
    gamepad: {
      enabled: typeof r.gamepad?.enabled === 'boolean' ? r.gamepad.enabled : d.gamepad.enabled,
      deadzone: typeof r.gamepad?.deadzone === 'number' && Number.isFinite(r.gamepad.deadzone) ? clamp(r.gamepad.deadzone, 0.05, 0.6) : d.gamepad.deadzone,
      buttons,
    },
    touch: {
      dashButton: typeof r.touch?.dashButton === 'boolean' ? r.touch.dashButton : d.touch.dashButton,
      doubleTapDash: typeof r.touch?.doubleTapDash === 'boolean' ? r.touch.doubleTapDash : d.touch.doubleTapDash,
    },
  };
}

/**
 * Binds `key` to `action`. If another action already owns the key the two swap, so
 * nothing is ever left unbound. Movement keys are refused (returns the input).
 */
export function rebindKey(settings: ControlSettings, action: ControlAction, rawKey: string): ControlSettings {
  const key = rawKey.toLowerCase();
  if (RESERVED_KEYS.includes(key) || key.length === 0) return settings;
  const keys = { ...settings.keys };
  const owner = CONTROL_ACTIONS.find((a) => a !== action && keys[a] === key);
  if (owner) keys[owner] = keys[action];
  keys[action] = key;
  return { ...settings, keys };
}

/** Binds a controller button to an action, swapping with whichever action had it. */
export function rebindButton(settings: ControlSettings, action: ControlAction, button: number): ControlSettings {
  if (!Number.isInteger(button) || button < 0 || button > 15) return settings;
  const buttons = { ...settings.gamepad.buttons };
  const owner = CONTROL_ACTIONS.find((a) => a !== action && buttons[a] === button);
  if (owner) buttons[owner] = buttons[action];
  buttons[action] = button;
  return { ...settings, gamepad: { ...settings.gamepad, buttons } };
}

/** The action a key is bound to, or undefined. */
export function actionForKey(settings: ControlSettings, key: string): ControlAction | undefined {
  const k = key.toLowerCase();
  return CONTROL_ACTIONS.find((a) => settings.keys[a] === k);
}

/**
 * Radial deadzone with rescale, so a stick just past the deadzone starts near zero
 * instead of jumping to the deadzone's value. Returns a vector of length <= 1.
 */
export function stickVector(x: number, y: number, deadzone: number): { x: number; y: number } {
  const length = Math.hypot(x, y);
  if (!Number.isFinite(length) || length <= deadzone) return { x: 0, y: 0 };
  const scaled = Math.min(1, (length - deadzone) / (1 - deadzone));
  return { x: (x / length) * scaled, y: (y / length) * scaled };
}

/** Left stick plus d-pad (buttons 12 to 15) as one move vector. The d-pad wins when pressed. */
export function padMove(
  axes: readonly number[], pressed: (button: number) => boolean, deadzone: number,
): { x: number; y: number } {
  let dx = 0;
  let dy = 0;
  if (pressed(14)) dx -= 1;
  if (pressed(15)) dx += 1;
  if (pressed(12)) dy -= 1;
  if (pressed(13)) dy += 1;
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    return { x: dx / len, y: dy / len };
  }
  return stickVector(axes[0] ?? 0, axes[1] ?? 0, deadzone);
}

/**
 * The direction a dash goes: where the player is steering, otherwise the way they last
 * moved, otherwise the way they face. Never a zero vector.
 */
export function dashDirection(
  move: { x: number; y: number }, last: { x: number; y: number } | null, facing: number,
): { x: number; y: number } {
  if (Math.hypot(move.x, move.y) > 0.15) return move;
  if (last && Math.hypot(last.x, last.y) > 0.15) return last;
  return { x: facing >= 0 ? 1 : -1, y: 0 };
}

const STORAGE_KEY = 'survivor616.controls.v1';
let cached: ControlSettings | null = null;

/** The current controls. Cheap: reads storage once, then the cache. */
export function getControls(): ControlSettings {
  if (cached) return cached;
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    cached = normalizeControls(raw ? JSON.parse(raw) : null);
  } catch {
    cached = normalizeControls(null);
  }
  return cached;
}

export function saveControls(next: ControlSettings): ControlSettings {
  cached = normalizeControls(next);
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cached)); } catch { /* lasts until reload */ }
  return cached;
}

export function resetControls(): ControlSettings {
  return saveControls(DEFAULT_CONTROLS);
}
