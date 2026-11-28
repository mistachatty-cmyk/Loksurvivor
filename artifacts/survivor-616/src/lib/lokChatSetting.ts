/**
 * Which parts of LOK Chat are on. The effective switch for each feature is the game's manifest
 * (`lokChat` in `lok.universe.json`) AND the player's own device-local choice (default on).
 * Off means the feature generates nothing, stores nothing and shows nothing.
 */
import { CHAT_FEATURES, featureOn, mergeFeatures, type ChatFeature, type FeatureFlags } from '@lok/chat';

import manifest from '../../lok.universe.json';

const KEY = 'survivor616.lokChat.features';
const CHANGE_EVENT = 'survivor616:lokChat-setting';

const manifestFlags = (): FeatureFlags => {
  const block = (manifest as { lokChat?: { enabled?: boolean; features?: FeatureFlags } }).lokChat;
  if (!block) return {};
  return { ...(block.features ?? {}), ...(block.enabled === false ? { chat: false } : {}) };
};

function readPlayer(): FeatureFlags {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: FeatureFlags = {};
    for (const f of CHAT_FEATURES) if ((parsed as Record<string, unknown>)[f] === false) out[f] = false;
    return out;
  } catch {
    return {};
  }
}

/** The combined flags; read on every call so a settings change applies at once. */
export function lokChatFeatures(): FeatureFlags {
  return mergeFeatures(manifestFlags(), typeof window === 'undefined' ? {} : readPlayer());
}

export const lokChatFeatureOn = (feature: ChatFeature): boolean => featureOn(lokChatFeatures(), feature);

/** Whether the game's manifest lets this feature exist at all (the player toggle is hidden when not). */
export const lokChatFeatureAllowed = (feature: ChatFeature): boolean => featureOn(manifestFlags(), feature);

export function setLokChatFeature(feature: ChatFeature, on: boolean): void {
  const next = readPlayer();
  if (on) delete next[feature]; else next[feature] = false;
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* lasts until reload */ }
  try { window.dispatchEvent(new Event(CHANGE_EVENT)); } catch { /* no window */ }
}

export function onLokChatSettingChange(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}
