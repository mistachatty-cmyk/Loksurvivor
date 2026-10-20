import { useEffect, useState, type CSSProperties } from 'react';

import type { Reporter } from '../reporter';
import type { ErrorReport } from '../types';
import { LokCrashPopup } from './LokCrashPopup';
import { defaultStrings, type LokErrorStrings } from './strings';

export interface LokErrorHostProps {
  reporter: Reporter;
  strings?: LokErrorStrings;
  onSend?: (report: ErrorReport) => Promise<void>;
  accent?: string;
}

const chip: CSSProperties = {
  position: 'fixed', left: 12, bottom: 12, zIndex: 2147482999, display: 'flex', alignItems: 'center', gap: 8,
  border: '1px solid rgba(34,211,238,.5)', background: 'rgba(14,10,28,.94)', color: '#f4f0ff', padding: '8px 10px',
  font: '700 11px ui-monospace, monospace', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer',
};

/**
 * Crashes that are not render crashes (a thrown error in a timer, a rejected promise) leave the app
 * running, so they get a small chip instead of a full screen. One at a time; the chip opens the pop-up.
 */
export function LokErrorHost({ reporter, strings = defaultStrings, onSend, accent }: LokErrorHostProps) {
  const [pending, setPending] = useState<ErrorReport | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => reporter.subscribe(({ report, fresh }) => {
    if (!fresh || report.severity !== 'crash' || report.kind === 'render') return;
    setPending((current) => current ?? report);
  }), [reporter]);

  if (!pending) return null;
  if (open) {
    return (
      <LokCrashPopup
        report={pending}
        strings={strings}
        onSend={onSend}
        accent={accent}
        onClose={() => { setOpen(false); setPending(null); }}
      />
    );
  }
  return (
    <button type="button" style={chip} onClick={() => setOpen(true)} data-testid="lok-crash-chip" aria-label={`${strings.chip}. ${strings.chipOpen}`}>
      <span aria-hidden="true">◐</span>{strings.chip}
    </button>
  );
}
