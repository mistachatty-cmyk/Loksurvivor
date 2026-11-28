/**
 * Every part of LOK Chat can be switched off. The effective switch is the app's manifest
 * (`lokChat.features` in `lok.universe.json`) AND the player's own choice; an app builds that
 * combined `FeatureFlags` and hands the package a function returning it. An off feature
 * generates nothing, stores nothing and shows nothing. `chat` is the master switch for the messenger and everything built on it; `strip` (one-way hideout lines) stands alone.
 */
import type { ChatFeature } from './types';

export type FeatureFlags = Partial<Record<ChatFeature, boolean>>;

export const CHAT_FEATURES: ReadonlyArray<ChatFeature> = [
  'chat', 'depth', 'questionsBack', 'twoBubbles', 'proactive', 'memory', 'strip', 'scenes', 'group', 'moods', 'presence', 'reactions',
];

/** Unset means on; only an explicit `false` turns a feature off, and `chat: false` turns everything off. */
export function featureOn(flags: FeatureFlags | undefined, feature: ChatFeature): boolean {
  if (!flags) return true;
  // The messenger switch gates everything that lives in the messenger; hideout chatter (`strip`) is its own thing.
  if (feature !== 'strip' && flags.chat === false) return false;
  return flags[feature] !== false;
}

/** The manifest allows it AND the player has not turned it off. */
export function mergeFeatures(manifest: FeatureFlags | undefined, player: FeatureFlags | undefined): FeatureFlags {
  const out: FeatureFlags = {};
  for (const f of CHAT_FEATURES) out[f] = featureOn(manifest, f) && featureOn(player, f);
  return out;
}
