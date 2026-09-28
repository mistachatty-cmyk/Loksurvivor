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

import { earnLokTokens, getLokProfile, type LokProfileRank } from '@workspace/lok-client';

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
}

const LokEconomyContext = createContext<LokEconomyContextValue>({
  balance: null,
  lifetimeEarned: null,
  rank: null,
  earn: () => {},
});

export function LokEconomyProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [lifetimeEarned, setLifetimeEarned] = useState<number | null>(null);
  const [rank, setRank] = useState<LokProfileRank | null>(null);
  const refreshedForUserId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!lokClient || !session) {
      setBalance(null);
      setLifetimeEarned(null);
      setRank(null);
      return;
    }
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

  const value: LokEconomyContextValue = { balance, lifetimeEarned, rank, earn };
  return <LokEconomyContext.Provider value={value}>{children}</LokEconomyContext.Provider>;
}

export function useLokEconomy(): LokEconomyContextValue {
  return useContext(LokEconomyContext);
}
