/**
 * Thin wrapper around `useCountUp` for inline JSX use (hooks can't be
 * called directly inside a `.map`/ternary, so stat cards render this
 * instead of calling the hook themselves).
 */
import { useCountUp, type UseCountUpOptions } from '@/hooks/useCountUp';

export interface AnimatedNumberProps extends UseCountUpOptions {
  value: number;
  suffix?: string;
  className?: string;
  'data-testid'?: string;
}

export function AnimatedNumber({ value, suffix = '', className, 'data-testid': testId, ...options }: AnimatedNumberProps) {
  const display = useCountUp(value, options);
  return (
    <span className={className} data-testid={testId}>
      {display}
      {suffix}
    </span>
  );
}

export default AnimatedNumber;
