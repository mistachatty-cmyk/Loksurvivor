/**
 * Which Lok ecosystem plugins this app has switched on.
 *
 * `lok.universe.json` is the single source of truth: a plugin is on only when
 * its block is present there, the same way `supporterBar` and `walletStrip`
 * work. A product that has not opted in to the Lok ecosystem features simply
 * has no block and the plugin never appears.
 */
import {
  ARTIST_SUBMIT_MANIFEST_KEY,
  type ArtistSubmitConfig,
  createArtistSubmitConfig,
  parseArtistSubmitFeature,
} from '@lok/artist-submit';
import manifest from '../../lok.universe.json';

/** Whether the artist-submit plugin is on, and where it may be mounted. */
export const ARTIST_SUBMIT_FEATURE = parseArtistSubmitFeature(
  (manifest as Record<string, unknown>)[ARTIST_SUBMIT_MANIFEST_KEY],
);

/**
 * Host settings for the plugin: this app's name plus the ecosystem defaults.
 * `null` when the settings are unusable. A bad manifest edit must switch the
 * feature off, never take the whole app down at import time.
 */
export const ARTIST_SUBMIT_CONFIG: ArtistSubmitConfig | null = (() => {
  try {
    return createArtistSubmitConfig({
      appKey: manifest.appKey,
      appLabel: manifest.label,
      recipient: ARTIST_SUBMIT_FEATURE.recipient,
    });
  } catch (error) {
    console.warn('Artist submissions are switched off:', error);
    return null;
  }
})();
