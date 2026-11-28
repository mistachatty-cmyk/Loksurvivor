// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
/**
 * Lok haptics: one shared, polite way for every Lok game and app to buzz a phone or rumble a controller.
 *
 * Games ask for a named cue ("tap", "hit", "crown"...) and never think about patterns, strength or support.
 * Players choose On/Off and a strength in the game's settings; the choice is shared by every Lok app on the
 * same site. Every cue is rate-limited so a busy moment never turns into a constant buzz, and strength
 * "off" costs nothing. Phones use navigator.vibrate (Android browsers; iPhone Safari has none, so it quietly
 * does nothing). Controllers use the Gamepad vibrationActuator where the browser offers it (Chrome, Edge and
 * the Xbox browser do).
 *
 * Framework-free; pure helpers are exported for tests.
 */

export type HapticStrength = "off" | "light" | "normal" | "strong";
export interface HapticPrefs {
  strength: HapticStrength;
  /** Also rumble a connected controller. */
  controller: boolean;
}

/** What happened, in the game's own words. Add cues here as games need them (keep them generic). */
export type HapticCue =
  | "tap" // a button or tile press
  | "step" // a small repeating beat: a hop, a footstep
  | "pickup" // a coin, gem or small reward
  | "hit" // you took or dealt a hit
  | "bump" // two things collided
  | "bank" // something was safely banked
  | "crown" // a major win moment
  | "win" // the match is won
  | "lose" // the match is lost
  | "warn" // danger is coming
  | "tick"; // a countdown beat

export const HAPTIC_PREFS_KEY = "lok.haptics.v1";
export const HAPTIC_PREFS_EVENT = "lokhaptics:prefs";
export const HAPTIC_STRENGTHS: HapticStrength[] = ["off", "light", "normal", "strong"];
export const DEFAULT_HAPTIC_PREFS: HapticPrefs = { strength: "normal", controller: true };

/** Base pattern in milliseconds: vibrate, pause, vibrate... Scaled by strength. */
const BASE: Record<HapticCue, number[]> = {
  tap: [8],
  step: [5],
  pickup: [10, 30, 12],
  hit: [28],
  bump: [18],
  bank: [14, 40, 22],
  crown: [20, 50, 20, 50, 60],
  win: [30, 60, 30, 60, 90],
  lose: [70, 70, 40],
  warn: [24, 80, 24],
  tick: [6],
};
/** Minimum gap between two uses of the same cue, so nothing becomes a constant buzz. */
const MIN_GAP_MS: Record<HapticCue, number> = {
  tap: 40, step: 90, pickup: 70, hit: 90, bump: 120, bank: 150, crown: 400, win: 800, lose: 800, warn: 600, tick: 300,
};
const SCALE: Record<HapticStrength, number> = { off: 0, light: 0.6, normal: 1, strong: 1.6 };

export function normalizeHapticPrefs(raw: unknown): HapticPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<HapticPrefs>;
  return {
    strength: HAPTIC_STRENGTHS.includes(r.strength as HapticStrength) ? (r.strength as HapticStrength) : DEFAULT_HAPTIC_PREFS.strength,
    controller: typeof r.controller === "boolean" ? r.controller : DEFAULT_HAPTIC_PREFS.controller,
  };
}

/** The scaled pattern for a cue; empty when strength is off. Vibrate steps scale, pauses stay the same. */
export function hapticPattern(cue: HapticCue, strength: HapticStrength): number[] {
  const k = SCALE[strength];
  if (k === 0) return [];
  return BASE[cue].map((ms, i) => (i % 2 === 0 ? Math.max(1, Math.round(ms * k)) : ms));
}

/** Controller rumble for a cue: total length and motor strengths (0..1). */
export function padRumble(cue: HapticCue, strength: HapticStrength): { duration: number; weak: number; strong: number } | null {
  const k = SCALE[strength];
  if (k === 0) return null;
  const total = BASE[cue].reduce((n, ms) => n + ms, 0);
  const heavy = cue === "hit" || cue === "bump" || cue === "lose" || cue === "crown" || cue === "win";
  return { duration: Math.min(500, Math.round(total * 1.4 * k)), weak: Math.min(1, (heavy ? 0.5 : 0.8) * k), strong: Math.min(1, (heavy ? 0.9 : 0.25) * k) };
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;
const store = (): StorageLike | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

export function readHapticPrefs(storage: StorageLike | null = store()): HapticPrefs {
  try {
    return normalizeHapticPrefs(JSON.parse(storage?.getItem(HAPTIC_PREFS_KEY) ?? "null"));
  } catch {
    return { ...DEFAULT_HAPTIC_PREFS };
  }
}

export function writeHapticPrefs(next: Partial<HapticPrefs>, storage: StorageLike | null = store()): HapticPrefs {
  const merged = normalizeHapticPrefs({ ...readHapticPrefs(storage), ...next });
  try {
    storage?.setItem(HAPTIC_PREFS_KEY, JSON.stringify(merged));
  } catch {
    /* private mode: the choice just will not persist */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(HAPTIC_PREFS_EVENT, { detail: merged }));
  return merged;
}

/** What this device can do, for the settings page and config checks. */
export function hapticSupport(): { phone: boolean; controller: boolean } {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  const phone = !!nav && typeof nav.vibrate === "function";
  let controller = false;
  try {
    const pads = nav?.getGamepads?.() ?? [];
    controller = Array.from(pads).some((p) => !!p && !!(p as Gamepad & { vibrationActuator?: unknown }).vibrationActuator);
  } catch {
    /* some browsers throw before a user gesture */
  }
  return { phone, controller };
}

const lastAt = new Map<HapticCue, number>();
let cached: HapticPrefs | null = null;
if (typeof window !== "undefined") window.addEventListener(HAPTIC_PREFS_EVENT, (e) => (cached = normalizeHapticPrefs((e as CustomEvent).detail)));

/** Decide whether a cue may fire now (strength on and the per-cue gap has passed). Exported for tests. */
export function hapticAllowed(cue: HapticCue, strength: HapticStrength, now: number, last: Map<HapticCue, number> = lastAt): boolean {
  if (strength === "off") return false;
  const prev = last.get(cue);
  if (prev !== undefined && now - prev < MIN_GAP_MS[cue]) return false;
  last.set(cue, now);
  return true;
}

/** Fire a cue. Safe to call anywhere, any time: it does nothing when unsupported, off, or too soon. */
export function haptic(cue: HapticCue): void {
  if (typeof navigator === "undefined") return;
  const prefs = (cached ??= readHapticPrefs());
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (!hapticAllowed(cue, prefs.strength, now)) return;
  try {
    const pattern = hapticPattern(cue, prefs.strength);
    if (pattern.length && typeof navigator.vibrate === "function") navigator.vibrate(pattern);
    if (prefs.controller) {
      const r = padRumble(cue, prefs.strength);
      if (!r) return;
      for (const p of navigator.getGamepads?.() ?? []) {
        const act = (p as (Gamepad & { vibrationActuator?: { playEffect?: (t: string, o: object) => Promise<unknown> } }) | null)?.vibrationActuator;
        void act?.playEffect?.("dual-rumble", { startDelay: 0, duration: r.duration, weakMagnitude: r.weak, strongMagnitude: r.strong })?.catch?.(() => undefined);
      }
    }
  } catch {
    /* haptics are a nicety: never let one break a game */
  }
}
