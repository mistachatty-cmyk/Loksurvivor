/**
 * A soft, twice-and-done nudge to save progress to an account. Shown on the
 * run summary after the player's first completed run, and once again
 * around their fifth if they still haven't signed in -- then never again.
 *
 * Deliberately anonymous-first: this never blocks anything, renders
 * nothing at all while auth isn't configured yet (`available` false, same
 * gate every other account UI in this codebase already uses) or once the
 * player is signed in, and a dismiss is just a dismiss -- no guilt copy,
 * no re-prompting on the very next run.
 */
import { useState } from 'react';
import { CloudUpload, X } from 'lucide-react';

import { useAuth } from '@/state/authStore';

/** Which completed-run counts get a nudge. Two touchpoints, then silence. */
const NUDGE_RUN_NUMBERS = [1, 5];

export interface AccountNudgeProps {
  /** `meta.totalRuns` after this run -- i.e. how many runs the player has now completed, including this one. */
  runNumber: number;
  onOpenAccount: () => void;
}

export function AccountNudge({ runNumber, onOpenAccount }: AccountNudgeProps) {
  const { available, session } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (!available || session || dismissed) return null;
  if (!NUDGE_RUN_NUMBERS.includes(runNumber)) return null;

  return (
    <section
      className="border border-primary/30 bg-primary/5 p-4 flex flex-wrap items-center justify-between gap-3"
      data-testid="section-account-nudge"
    >
      <div className="flex items-center gap-3 min-w-0">
        <CloudUpload className="w-4 h-4 text-primary shrink-0" />
        <p className="text-sm text-white/85">
          {runNumber === 1
            ? "Progress like this only lives in this browser right now. Save it to an account and it'll follow you anywhere."
            : "Still just here -- create an account any time to keep this progress safe across devices."}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onOpenAccount}
          className="text-xs font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
          data-testid="button-account-nudge-open"
        >
          Save progress
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="text-white/40 hover:text-white/70 transition-colors"
          data-testid="button-account-nudge-dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </section>
  );
}

export default AccountNudge;
