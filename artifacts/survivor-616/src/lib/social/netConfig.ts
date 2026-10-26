/**
 * The dial for everything that talks to the shared database live (presence, crew chat, listening together,
 * crew runs). Defaults are deliberately gentle. A small static file, `lok-net.json`, served with the game can
 * turn a feature off or slow it down for every player without a code change, which is the lever to pull if
 * the free Realtime allowance ever runs hot. The file is fetched once per session; if it cannot be read,
 * the defaults apply. Nothing here is secret and nothing is sent anywhere.
 */
import { useSyncExternalStore } from 'react';

export interface NetConfig {
  presence: boolean;
  chat: boolean;
  listen: boolean;
  crewRuns: boolean;
  /** Most chat lines and emotes one player may send per minute. */
  chatPerMinute: number;
  /** How many times a second the host of a crew run broadcasts. */
  runTickHz: number;
}

export const DEFAULT_NET: NetConfig = { presence: true, chat: true, listen: true, crewRuns: true, chatPerMinute: 20, runTickHz: 4 };

const clamp = (value: unknown, min: number, max: number, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;
const flag = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback);

/** Reads whatever the file held; anything missing or out of range falls back to the gentle default. */
export function parseNetConfig(raw: unknown): NetConfig {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    presence: flag(value.presence, DEFAULT_NET.presence),
    chat: flag(value.chat, DEFAULT_NET.chat),
    listen: flag(value.listen, DEFAULT_NET.listen),
    crewRuns: flag(value.crewRuns, DEFAULT_NET.crewRuns),
    chatPerMinute: clamp(value.chatPerMinute, 1, 60, DEFAULT_NET.chatPerMinute),
    runTickHz: clamp(value.runTickHz, 1, 8, DEFAULT_NET.runTickHz),
  };
}

/** A token bucket: `take` is true while the sender is within its allowance. Refills `perSec` a second up to `burst`. */
export function createBudget(perSec: number, burst: number): { take: (nowMs: number) => boolean } {
  let tokens = burst;
  let at = 0;
  return {
    take(nowMs) {
      if (at === 0) at = nowMs;
      tokens = Math.min(burst, tokens + ((nowMs - at) / 1000) * perSec);
      at = nowMs;
      if (tokens < 1) return false;
      tokens -= 1;
      return true;
    },
  };
}

let current: NetConfig = DEFAULT_NET;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function getNetConfig(): NetConfig { return current; }

/** Fetches the dial once per session. Never throws and never takes longer than a few seconds. */
export function loadNetConfig(fetcher: typeof fetch = fetch, url = `${import.meta.env.BASE_URL}lok-net.json`): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    try {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const giveUp = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 4000); });
      const response = await Promise.race([fetcher(url, { cache: 'no-cache' }), giveUp]);
      clearTimeout(timer);
      if (!response.ok) return;
      current = parseNetConfig(await response.json());
      listeners.forEach((listener) => listener());
    } catch { /* the defaults stand */ }
  })();
  return loading;
}

export function useNetConfig(): NetConfig {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getNetConfig,
    getNetConfig,
  );
}
