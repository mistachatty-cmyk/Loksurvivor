/**
 * JSX-friendly wrapper around `useRevealingStat`, same relationship
 * `AnimatedNumber` has to `useCountUp`.
 */
import { useRevealingStat } from '@/hooks/useRevealingStat';
import type { UseCountUpOptions } from '@/hooks/useCountUp';

export interface RevealingNumberProps extends UseCountUpOptions {
  /** Stable key this number is tracked under in `meta.revealedStats` -- e.g. `cred`, `bestiary:${enemyId}`, `mastery-kills:${characterId}`. */
  statKey: string;
  value: number;
  suffix?: string;
  className?: string;
  'data-testid'?: string;
}

export function RevealingNumber({ statKey, value, suffix = '', className, 'data-testid': testId, ...options }: RevealingNumberProps) {
  const { display, ref } = useRevealingStat<HTMLSpanElement>(statKey, value, options);
  return (
    <span ref={ref} className={className} data-testid={testId}>
      {display}
      {suffix}
    </span>
  );
}

export default RevealingNumber;
