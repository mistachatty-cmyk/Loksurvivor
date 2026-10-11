/**
 * The Lok wallet strip: every shop shows the player's LokToken balance, or offers sign-in
 * when signed out. Required on every Lok platform's shops (LOK_PLATFORMS.md). Reads state the
 * app already holds (`useLokEconomy`, `useAuth`), so it adds no network requests.
 */
import { Coins } from 'lucide-react';

import { walletStripState } from '@workspace/lok-client';

import { useT } from '@/lib/i18n';
import { useLokEconomy } from '@/state/lokEconomyStore';
import { useAuth } from '@/state/authStore';

export function LokWalletStrip({ onSignIn }: { onSignIn?: () => void }) {
  const t = useT();
  const { signedIn, balance, rank } = useLokEconomy();
  const { available } = useAuth();
  const state = walletStripState({ signedIn, balance, authAvailable: available });

  return (
    <div className="lokshop-holo mb-3 flex items-center justify-between gap-3 px-3 py-2" data-testid="lok-wallet-strip" data-state={state.kind}>
      <span className="flex min-w-0 items-center gap-2 text-xs">
        <Coins className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
        {state.kind === 'signed-in' ? (
          <span className="truncate">
            <span className="font-mono font-black text-amber-200" data-testid="lok-wallet-balance">{t('wallet.balance', { n: state.balance.toLocaleString() })}</span>
            {rank?.label ? <span className="ml-2 text-muted-foreground">{t('wallet.rank', { rank: rank.label })}</span> : null}
          </span>
        ) : state.kind === 'loading' ? (
          <span className="text-muted-foreground" data-testid="lok-wallet-loading">{t('wallet.loading')}</span>
        ) : state.kind === 'sign-in' ? (
          <span className="text-muted-foreground">{t('wallet.signedOut')}</span>
        ) : (
          <span className="text-muted-foreground">{t('wallet.offline')}</span>
        )}
      </span>
      {state.kind === 'sign-in' && onSignIn ? (
        <button type="button" onClick={onSignIn} className="shrink-0 border border-cyan-300/70 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-200 hover:bg-cyan-300 hover:text-black" data-testid="button-wallet-sign-in">
          {t('wallet.signIn')}
        </button>
      ) : null}
    </div>
  );
}
