/**
 * Sits in the run summary next to the existing actions. Draws the card on
 * demand rather than on mount -- most players never tap it, and a canvas draw
 * during the stat count-up would fight for the same frame.
 */
import { useState } from 'react';
import { shareRecapCard, toRecapProps, type GameRunSummaryLike } from '@lok/recap';

type Status = 'idle' | 'working' | 'shared' | 'downloaded' | 'error';

const LABEL: Record<Status, string> = {
  idle: 'Share this run',
  working: 'Drawing card…',
  shared: 'Shared',
  downloaded: 'Saved to your device',
  error: "Couldn't make the card — try again",
};

export interface ShareRecapButtonProps {
  summary: GameRunSummaryLike;
  className?: string;
}

export function ShareRecapButton({ summary, className }: ShareRecapButtonProps) {
  const [status, setStatus] = useState<Status>('idle');

  const onShare = async () => {
    setStatus('working');
    try {
      const result = await shareRecapCard(toRecapProps(summary));
      setStatus(result);
    } catch (err) {
      console.error('Recap card failed', err);
      setStatus('error');
    }
  };

  return (
    <button
      type="button"
      onClick={onShare}
      disabled={status === 'working'}
      className={className}
      aria-live="polite"
      data-testid="button-share-recap"
    >
      {LABEL[status]}
    </button>
  );
}

export default ShareRecapButton;
