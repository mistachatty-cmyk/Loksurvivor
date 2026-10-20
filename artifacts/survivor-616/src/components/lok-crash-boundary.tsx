import type { ReactNode } from 'react';

import { LokCrashBoundary, LokErrorHost } from '@lok/error-report/react';

import { DefaultFallback } from '@/components/error-boundary';
import { canSendToLok, lokCloud, reporter, sendReportToLok } from '@/lib/lokErrorReport';
import { getLokErrorAutoSend, setLokErrorAutoSend } from '@/lib/lokErrorReportSetting';
import { lokErrorStrings } from '@/lib/lokErrorStrings';

/**
 * The game's crash boundary: LokServer's pop-up when LokErrorReport is on, the plain fallback when
 * it is off. `resetKey` clears a caught crash on navigation, as the old boundary did.
 */
export function AppCrashBoundary({ children, resetKey }: { children: ReactNode; resetKey?: unknown }) {
  return (
    <LokCrashBoundary
      reporter={reporter}
      strings={lokErrorStrings()}
      onSend={canSendToLok() ? sendReportToLok : undefined}
      autoSend={getLokErrorAutoSend()}
      onAutoSendChange={setLokErrorAutoSend}
      isSent={lokCloud?.sent}
      resetKey={resetKey}
      fallbackWhenOff={(error, reset) => <DefaultFallback error={error} resetError={reset} />}
    >
      {children}
    </LokCrashBoundary>
  );
}

/** The small "LokServer caught a flicker" chip for crashes that leave the game running. */
export function AppCrashHost() {
  return <LokErrorHost reporter={reporter} strings={lokErrorStrings()} onSend={canSendToLok() ? sendReportToLok : undefined}
      autoSend={getLokErrorAutoSend()}
      onAutoSendChange={setLokErrorAutoSend}
      isSent={lokCloud?.sent} />;
}
