/**
 * Demo Day settings v1: a small declarative schema (the real game's Settings screen is a large React/Tailwind
 * component that cannot ship in this bundle), plus validation, persistence and a copy/paste settings code.
 * Pure and storage-injected so it runs under node. Settings are not secret and never hold anything account-related.
 */

export type SettingKind = 'toggle' | 'choice';

export interface ChoiceOption {
  value: string;
  /** Message key suffix: `overlay.value.<labelKey>`. */
  labelKey: string;
}

export interface SettingDef {
  id: SettingId;
  kind: SettingKind;
  group: 'gameplay' | 'graphics' | 'audio';
  /** Message key suffix: `overlay.setting.<labelKey>`. */
  labelKey: string;
  options?: readonly ChoiceOption[];
}

export type SettingId =
  | 'mode'
  | 'levelUp'
  | 'gameSpeed'
  | 'shake'
  | 'hitStop'
  | 'damageNumbers'
  | 'reducedFlashes'
  | 'glow'
  | 'outline'
  | 'sfx';

export interface Settings {
  mode: 'survival' | 'zen';
  levelUp: 'pause' | 'auto';
  /** Multiplies the time given to the simulation (the engine has no global speed). */
  gameSpeed: '1' | '1.15' | '1.3';
  shake: boolean;
  hitStop: boolean;
  damageNumbers: boolean;
  reducedFlashes: boolean;
  glow: boolean;
  outline: boolean;
  sfx: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'survival',
  levelUp: 'pause',
  gameSpeed: '1',
  shake: true,
  hitStop: true,
  damageNumbers: true,
  reducedFlashes: false,
  glow: true,
  outline: true,
  sfx: true,
};


export const SETTINGS_SCHEMA: readonly SettingDef[] = [
  { id: 'mode', kind: 'choice', group: 'gameplay', labelKey: 'mode', options: [{ value: 'survival', labelKey: 'survival' }, { value: 'zen', labelKey: 'zen' }] },
  { id: 'levelUp', kind: 'choice', group: 'gameplay', labelKey: 'levelUp', options: [{ value: 'pause', labelKey: 'pause' }, { value: 'auto', labelKey: 'auto' }] },
  { id: 'gameSpeed', kind: 'choice', group: 'gameplay', labelKey: 'gameSpeed', options: [{ value: '1', labelKey: 'speed1' }, { value: '1.15', labelKey: 'speed115' }, { value: '1.3', labelKey: 'speed13' }] },
  { id: 'shake', kind: 'toggle', group: 'gameplay', labelKey: 'shake' },
  { id: 'hitStop', kind: 'toggle', group: 'gameplay', labelKey: 'hitStop' },
  { id: 'damageNumbers', kind: 'toggle', group: 'gameplay', labelKey: 'damageNumbers' },
  { id: 'reducedFlashes', kind: 'toggle', group: 'graphics', labelKey: 'reducedFlashes' },
  { id: 'glow', kind: 'toggle', group: 'graphics', labelKey: 'glow' },
  { id: 'outline', kind: 'toggle', group: 'graphics', labelKey: 'outline' },
  { id: 'sfx', kind: 'toggle', group: 'audio', labelKey: 'sfx' },
];

const STORAGE_KEY = 'demoday.settings.v1';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Keep only known keys with allowed values; anything else falls back to the default. Never throws. */
export function sanitizeSettings(raw: unknown): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return out;
  const src = raw as Record<string, unknown>;
  for (const def of SETTINGS_SCHEMA) {
    const value = src[def.id];
    if (def.kind === 'toggle') {
      if (typeof value === 'boolean') (out as unknown as Record<string, unknown>)[def.id] = value;
    } else if (typeof value === 'string' && def.options?.some((o) => o.value === value)) {
      (out as unknown as Record<string, unknown>)[def.id] = value;
    }
  }
  return out;
}

export function loadSettings(storage: KeyValueStorage | null): Settings {
  try {
    const text = storage?.getItem(STORAGE_KEY);
    return text ? sanitizeSettings(JSON.parse(text)) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(storage: KeyValueStorage | null, settings: Settings): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage blocked or full: the choice lasts for this run only.
  }
}

/** The values (as strings) a setting can take, for cycling a control. */
export function optionValues(def: SettingDef): string[] {
  return def.kind === 'toggle' ? ['true', 'false'] : (def.options ?? []).map((o) => o.value);
}

/** Next value of a setting when its control is clicked (toggles flip, choices cycle). */
export function nextSetting(settings: Settings, id: SettingId): Settings {
  const def = SETTINGS_SCHEMA.find((d) => d.id === id);
  if (!def) return settings;
  const current = String((settings as unknown as Record<string, unknown>)[id]);
  const values = optionValues(def);
  const next = values[(values.indexOf(current) + 1) % values.length] ?? values[0]!;
  return sanitizeSettings({ ...settings, [id]: def.kind === 'toggle' ? next === 'true' : next });
}

/** Multiplier for the simulation clock. */
export function gameSpeedFactor(settings: Settings): number {
  return Number(settings.gameSpeed) || 1;
}

/** A short code that carries settings between sites (the bookmarklet has no shared storage across origins). */
export function encodeSettingsCode(settings: Settings): string {
  const json = JSON.stringify(settings);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeSettingsCode(code: string): Settings | null {
  try {
    const b64 = code.trim().replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return parsed && typeof parsed === 'object' ? sanitizeSettings(parsed) : null;
  } catch {
    return null;
  }
}
