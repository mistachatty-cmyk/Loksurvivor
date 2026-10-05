/**
 * The player's shared cross-app LokTokens balance -- kept separate from
 * `cred` (metaStore.tsx's local-only soft currency, never networked) and
 * from cloudSyncStore.tsx (which syncs the local save blob, not the token
 * economy). Read-only balance/rank comes from `lok_profile` (already
 * grantable to `authenticated`, no server hop needed); earning goes through
 * the shared `lok-earn` edge function, since the RPCs that actually award
 * tokens are locked to `service_role` -- see lib/lok-client/src/economy.ts.
 *
 * Every call here is a no-op when auth isn't configured or nobody's signed
 * in: earning tokens must never block or error out gameplay.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  earnLokTokens,
  fetchCatalog,
  fetchOwnedSkus,
  getLokProfile,
  spendLokTokens,
  type LokProfileRank,
  type SpendResult,
} from '@workspace/lok-client';

import { useAuth } from '@/state/authStore';
import { lokClient } from '@/lib/lokClient';

/** This app's `lok_apps.app_key`. */
const APP_KEY = 'survivor616';

export interface EarnRef {
  refType?: string;
  refId?: string;
}

interface LokEconomyContextValue {
  balance: number | null;
  lifetimeEarned: number | null;
  rank: LokProfileRank | null;
  /** Fire-and-forget -- callers never need to await or handle its result. */
  earn: (eventKey: string, ref?: EarnRef) => void;
  signedIn: boolean;
  /** Catalog SKUs this account owns (server-side inventory, follows the account across devices). */
  ownedSkus: ReadonlySet<string>;
  /** Live LokToken price for a SKU, or undefined until the catalog loads / when it isn't sold. */
  priceOf: (sku: string) => number | undefined;
  /** Buy a catalog SKU. Resolves with the server's verdict; refreshes balance and inventory on success. */
  spend: (sku: string) => Promise<SpendResult>;
}

const LokEconomyContext = createContext<LokEconomyContextValue>({
  balance: null,
  lifetimeEarned: null,
  rank: null,
  earn: () => {},
  signedIn: false,
  ownedSkus: new Set<string>(),
  priceOf: () => undefined,
  spend: async () => ({ ok: false, error: 'not_signed_in' }),
});

export function LokEconomyProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [lifetimeEarned, setLifetimeEarned] = useState<number | null>(null);
  const [rank, setRank] = useState<LokProfileRank | null>(null);
  const [ownedSkus, setOwnedSkus] = useState<ReadonlySet<string>>(() => new Set());
  const [prices, setPrices] = useState<Record<string, number>>({});
  const refreshedForUserId = useRef<string | null>(null);

  // The catalog is public-read, so prices load even for signed-out players.
  useEffect(() => {
    if (!lokClient) return;
    void fetchCatalog(lokClient, APP_KEY).then((result) => {
      if (result.ok) setPrices(Object.fromEntries(result.items.map((item) => [item.sku, item.price])));
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!lokClient || !session) {
      setBalance(null);
      setLifetimeEarned(null);
      setRank(null);
      setOwnedSkus(new Set());
      return;
    }
    void fetchOwnedSkus(lokClient).then((owned) => {
      if (owned.ok) setOwnedSkus(new Set(owned.skus));
    });
    const profile = await getLokProfile(lokClient, session.user.id, APP_KEY);
    if (!profile.ok) return;
    setBalance(profile.balance ?? null);
    setLifetimeEarned(profile.lifetimeEarned ?? null);
    setRank(profile.rank ?? null);
  }, [session]);

  useEffect(() => {
    if (!session) {
      refreshedForUserId.current = null;
      void refresh();
      return;
    }
    if (refreshedForUserId.current === session.user.id) return;
    refreshedForUserId.current = session.user.id;
    void refresh();
  }, [session, refresh]);

  const earn = useCallback(
    (eventKey: string, ref?: EarnRef) => {
      if (!lokClient || !session) return;
      const idemKey = `${eventKey}:${ref?.refId ?? crypto.randomUUID()}`;
      void earnLokTokens(lokClient, {
        appKey: APP_KEY,
        eventKey,
        idemKey,
        refType: ref?.refType,
        refId: ref?.refId,
      }).then((result) => {
        if (result.ok) void refresh();
      });
    },
    [session, refresh],
  );

  const spend = useCallback(
    async (sku: string): Promise<SpendResult> => {
      if (!lokClient || !session) return { ok: false, error: 'not_signed_in' };
      // One idemKey per account+SKU: a retried request can never charge twice.
      const result = await spendLokTokens(lokClient, { appKey: APP_KEY, sku, idemKey: `buy:${sku}` });
      if (result.ok || result.error === 'already_owned') await refresh();
      return result;
    },
    [session, refresh],
  );
  const priceOf = useCallback((sku: string) => prices[sku], [prices]);

  const value: LokEconomyContextValue = {
    balance,
    lifetimeEarned,
    rank,
    earn,
    signedIn: !!session,
    ownedSkus,
    priceOf,
    spend,
  };
  return <LokEconomyContext.Provider value={value}>{children}</LokEconomyContext.Provider>;
}

export function useLokEconomy(): LokEconomyContextValue {
  return useContext(LokEconomyContext);
}
