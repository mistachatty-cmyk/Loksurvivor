import { useState } from 'react';

import { useT } from '@/lib/i18n';
import { lokCrash } from '@/lib/lokCrash';

type Status = 'idle' | 'sending' | 'sent' | 'failed' | 'unavailable';

/**
 * "Send to LOK Services": the player's own go-ahead to send the latest crash details, even when
 * automatic sending is off or their browser asks not to be tracked. It sends the same short, scrubbed
 * text the Copy button copies (no account, no device id), and says plainly how it went.
 */
export function SendCrashButton({ className, testId = 'button-send-crash-report' }: { className: string; testId?: string }) {
  const t = useT();
  const [status, setStatus] = useState<Status>('idle');
  const send = () => {
    setStatus('sending');
    void lokCrash.submit().then(setStatus, () => setStatus('failed'));
  };
  const label =
    status === 'sending' ? t('crash.send.sending') : status === 'sent' ? t('crash.send.sent') : t('crash.send');
  return (
    <>
      <button type="button" onClick={send} disabled={status === 'sending' || status === 'sent'} className={`${className} disabled:opacity-70`} data-testid={testId}>
        {label}
      </button>
      {status === 'failed' || status === 'unavailable' ? (
        <span role="status" className="block text-xs opacity-80" data-testid="text-send-crash-problem">
          {t(status === 'failed' ? 'crash.send.failed' : 'crash.send.unavailable')}
        </span>
      ) : null}
    </>
  );
}

export default SendCrashButton;
