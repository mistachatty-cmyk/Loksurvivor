import { isEmailShaped } from './config';
import type { ArtistSubmitFeature, ArtistSubmitMount } from './types';

/** The key a host uses in its `lok.universe.json` to turn this plugin on. */
export const ARTIST_SUBMIT_MANIFEST_KEY = 'artistSubmit';

const KNOWN_MOUNTS: readonly ArtistSubmitMount[] = ['music', 'studio', 'hub', 'shell'];

/**
 * Reads the plugin's block from a host manifest, for example
 * `"artistSubmit": { "mount": ["music"] }`. A missing or malformed block means
 * the plugin is off, so a product that has not opted in to the Lok ecosystem
 * features never shows it.
 */
export function parseArtistSubmitFeature(value: unknown): ArtistSubmitFeature {
  const off: ArtistSubmitFeature = { enabled: false, mounts: [] };
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return off;
  const block = value as { enabled?: unknown; mount?: unknown; recipient?: unknown };
  if (block.enabled === false) return off;

  const requested = Array.isArray(block.mount) ? block.mount : [];
  const mounts = KNOWN_MOUNTS.filter((mount) => requested.includes(mount));
  if (mounts.length === 0) return off;

  const recipient = typeof block.recipient === 'string' && isEmailShaped(block.recipient.trim())
    ? block.recipient.trim()
    : undefined;
  return recipient ? { enabled: true, mounts, recipient } : { enabled: true, mounts };
}

export function isMountedAt(feature: ArtistSubmitFeature, mount: ArtistSubmitMount): boolean {
  return feature.enabled && feature.mounts.includes(mount);
}
