import { getSession, startPlaytimeTracker } from '@workspace/lok-client';

import { lokClient, lokClientConfig } from '@/lib/lokClient';
import { LOKDEX_APP_KEY } from '@/lib/lokDexSnapshot';

/**
 * Reports active play time to the signed-in GSix account (`gsix_playtime_add`).
 * Counted while this tab is visible and focused. Signed-out play goes to the
 * separate cookieless guest tally (only the seconds are sent, nothing is stored,
 * and browsers sending Global Privacy Control or Do Not Track are skipped).
 * Nothing is sent when the game runs inside the GSix site's frame
 * (the site counts that minute itself, so it is never counted twice).
 *
 * Returns a cleanup function for an effect.
 */
export function startLokPlaytime(): () => void {
  if (!lokClient || !lokClientConfig) return () => {};
  const client = lokClient;
  const tracker = startPlaytimeTracker({
    appKey: LOKDEX_APP_KEY,
    supabaseUrl: lokClientConfig.url,
    publishableKey: lokClientConfig.anonKey,
    getAccessToken: async () => (await getSession(client)).session?.access_token ?? null,
    countGuests: true,
  });
  return () => tracker.stop();
}
