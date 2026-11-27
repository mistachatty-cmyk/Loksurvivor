/**
 * lib/lokConsole/core.ts -- console and TV profiles for the Lok ecosystem (Xbox, PlayStation, more).
 *
 * Pure rules, no game imports (test-enforced), so it can ship as `@lok/console` with the other
 * packages. It answers three questions a game keeps asking on a TV: what device is this, how hard can
 * the canvas work, and what do the pad buttons look like. Nothing here touches the network or storage.
 */

export type ConsoleKind = 'xbox-series' | 'xbox-one' | 'playstation-5' | 'playstation-4' | 'switch' | 'tv' | 'none';

export interface ConsoleProfile {
  kind: ConsoleKind;
  label: string;
  /** Highest canvas pixel ratio to start at. The frame governor can still step below it. */
  dprCap: number;
  /** Frame rate the device reasonably holds in its browser. */
  targetFps: number;
  /** Margin kept clear of the screen edge, as a share of width and height (TV title-safe area). */
  safeInset: number;
  /** Names for the four face buttons in action order: primary, secondary, tertiary, quaternary. */
  face: readonly [string, string, string, string];
  /** Names for the shoulder and menu buttons used in hints. */
  menu: string;
  rumble: boolean;
}

const XBOX_FACE = ['A', 'B', 'X', 'Y'] as const;
const PS_FACE = ['Cross', 'Circle', 'Square', 'Triangle'] as const;

const PROFILES: Record<ConsoleKind, ConsoleProfile> = {
  'xbox-series': { kind: 'xbox-series', label: 'Xbox Series X|S', dprCap: 1.25, targetFps: 60, safeInset: 0.02, face: XBOX_FACE, menu: 'Menu', rumble: true },
  'xbox-one': { kind: 'xbox-one', label: 'Xbox One', dprCap: 1, targetFps: 60, safeInset: 0.025, face: XBOX_FACE, menu: 'Menu', rumble: true },
  'playstation-5': { kind: 'playstation-5', label: 'PlayStation 5', dprCap: 1.25, targetFps: 60, safeInset: 0.02, face: PS_FACE, menu: 'Options', rumble: true },
  'playstation-4': { kind: 'playstation-4', label: 'PlayStation 4', dprCap: 1, targetFps: 60, safeInset: 0.025, face: PS_FACE, menu: 'Options', rumble: true },
  switch: { kind: 'switch', label: 'Nintendo Switch', dprCap: 1, targetFps: 30, safeInset: 0.02, face: ['B', 'A', 'Y', 'X'], menu: 'Plus', rumble: false },
  tv: { kind: 'tv', label: 'Smart TV', dprCap: 1, targetFps: 30, safeInset: 0.03, face: XBOX_FACE, menu: 'Menu', rumble: false },
  none: { kind: 'none', label: 'Device', dprCap: 2, targetFps: 60, safeInset: 0, face: XBOX_FACE, menu: 'Menu', rumble: true },
};

/** Which console or TV browser this user agent is. Unknown devices are 'none'. */
export function detectConsole(ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): ConsoleKind {
  if (/xbox/i.test(ua)) return /xbox one/i.test(ua) && !/series/i.test(ua) ? 'xbox-one' : 'xbox-series';
  if (/playstation 5|playstation5/i.test(ua)) return 'playstation-5';
  if (/playstation/i.test(ua)) return 'playstation-4';
  if (/nintendo/i.test(ua)) return 'switch';
  if (/tizen|web0s|webos|smart-?tv|crkey|aftb|bravia/i.test(ua)) return 'tv';
  return 'none';
}

export function consoleProfile(kind: ConsoleKind = detectConsole()): ConsoleProfile {
  return PROFILES[kind];
}

export type FaceAction = 'primary' | 'secondary' | 'tertiary' | 'quaternary';
const FACE_ORDER: readonly FaceAction[] = ['primary', 'secondary', 'tertiary', 'quaternary'];

/** The button name a player sees for an action on this device, e.g. "A" on Xbox, "Cross" on PlayStation. */
export function buttonName(action: FaceAction, p: ConsoleProfile = consoleProfile()): string {
  return p.face[FACE_ORDER.indexOf(action)];
}

/** Replace {primary} {secondary} {tertiary} {quaternary} {menu} in a hint with this device's names. */
export function padHint(template: string, p: ConsoleProfile = consoleProfile()): string {
  return template
    .replace(/\{(primary|secondary|tertiary|quaternary)\}/g, (_, a: FaceAction) => buttonName(a, p))
    .replace(/\{menu\}/g, p.menu);
}

/** Pixel ratio cap for a canvas on this device. */
export function consoleDprCap(kind: ConsoleKind = detectConsole()): number {
  return PROFILES[kind].dprCap;
}

interface RumbleActuator {
  playEffect?: (type: string, params: Record<string, number>) => Promise<unknown>;
}
interface RumblePad {
  connected: boolean;
  vibrationActuator?: RumbleActuator | null;
}

/**
 * Short controller rumble (console browsers ignore navigator.vibrate). Returns true when a pad took it.
 * strength 0..1, ms capped so a bug can never leave a pad buzzing.
 */
export function rumble(strength: number, ms: number, pads: readonly (RumblePad | null)[] = typeof navigator !== 'undefined' && navigator.getGamepads ? (Array.from(navigator.getGamepads()) as unknown as RumblePad[]) : []): boolean {
  const s = Math.max(0, Math.min(1, strength));
  const d = Math.max(0, Math.min(400, Math.round(ms)));
  let fired = false;
  for (const pad of pads) {
    const act = pad?.connected ? pad.vibrationActuator : null;
    if (!act?.playEffect) continue;
    try {
      void act.playEffect('dual-rumble', { startDelay: 0, duration: d, weakMagnitude: s * 0.6, strongMagnitude: s }).catch(() => undefined);
      fired = true;
    } catch {
      /* an unsupported pad is fine */
    }
  }
  return fired;
}
