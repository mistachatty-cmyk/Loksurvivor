import { useState } from 'react';

import { formatReport, takeRecoveredCrash } from '@/lib/lokCrash';
import { useT } from '@/lib/i18n';
import { SendCrashButton } from './SendCrashButton';

/** Shown once after the browser closed the game unexpectedly on the last visit. */
export function CrashRecoveryPrompt() {
  const t = useT();
  const [report] = useState(() => takeRecoveredCrash());
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  if (!report || !open) return null;
  return (
    <div
      role="alert"
      data-testid="crash-recovery-prompt"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[300] mx-auto max-h-[45dvh] max-w-sm overflow-y-auto border border-sky-300/60 bg-[#0a2540]/95 px-4 py-3 text-sky-100 shadow-[0_0_24px_rgba(56,189,248,0.25)]"
    >
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300">{t('crash.recovered.title')}</p>
      <p className="mt-1.5 text-sm leading-snug">{t('crash.recovered.body')}</p>
      <p className="mt-1 font-mono text-[10px] text-sky-300/70">{report.fingerprint}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] font-bold uppercase tracking-widest">
        <button
          type="button"
          className="text-sky-300 hover:text-white"
          onClick={() => {
            void navigator.clipboard?.writeText(formatReport(report)).then(() => setCopied(true)).catch(() => {});
          }}
        >
          {copied ? t('crash.recovered.copied') : t('crash.recovered.copy')}
        </button>
        <SendCrashButton className="text-sky-300 hover:text-white" testId="button-send-recovered-crash" />
        <button type="button" className="text-sky-300 hover:text-white" onClick={() => setOpen(false)}>
          {t('crash.recovered.close')}
        </button>
      </div>
    </div>
  );
}
