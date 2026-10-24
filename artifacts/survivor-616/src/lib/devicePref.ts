/**
 * A small device-local preference that components can follow live. Unlike the older read-once
 * prefs, changing one updates every screen using it straight away (and across browser tabs).
 * Storage can be blocked (private windows), so every read and write is guarded and the value
 * then simply lives until reload.
 */
import { useSyncExternalStore } from 'react';

export interface DevicePref<T extends string | boolean> {
  get(): T;
  set(value: T): void;
  subscribe(listener: () => void): () => void;
  /** React hook: the current value, re-rendering when it changes. */
  use(): T;
}

export function createPref<T extends string | boolean>(key: string, fallback: T, accepts?: (raw: string) => raw is T & string): DevicePref<T> {
  const listeners = new Set<() => void>();
  let memory: T | undefined;

  const decode = (raw: string | null): T => {
    if (raw === null) return fallback;
    if (typeof fallback === 'boolean') return (raw !== '0') as T;
    return !accepts || accepts(raw) ? (raw as T) : fallback;
  };
  const get = (): T => {
    if (memory !== undefined) return memory;
    try {
      return decode(window.localStorage.getItem(key));
    } catch {
      return fallback;
    }
  };
  const emit = () => listeners.forEach((l) => l());

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === key) {
        memory = undefined;
        emit();
      }
    });
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return {
    get,
    set(value) {
      memory = value;
      try {
        window.localStorage.setItem(key, typeof value === 'boolean' ? (value ? '1' : '0') : value);
      } catch {
        /* the choice lasts until reload */
      }
      emit();
    },
    subscribe,
    use: () => useSyncExternalStore(subscribe, get, () => fallback),
  };
}
