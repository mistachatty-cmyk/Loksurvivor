// Where this device remembers which onboarding steps are done or skipped. Cosmetic progress only, never authorization.
import { useCallback, useEffect, useState } from 'react';
import {
  EMPTY_ONBOARDING_STATE,
  markOnboardingStep,
  normalizeOnboardingState,
  type OnboardingState,
  type OnboardingStepDef,
} from '../../../../lib/lok-universe/src/onboarding';

export const ONBOARDING_KEY = 'survivor616.onboarding.v1';

export function readOnboarding(): OnboardingState {
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    return raw ? normalizeOnboardingState(JSON.parse(raw)) : { ...EMPTY_ONBOARDING_STATE, steps: {} };
  } catch {
    return { ...EMPTY_ONBOARDING_STATE, steps: {} };
  }
}

function writeOnboarding(state: OnboardingState): void {
  try { localStorage.setItem(ONBOARDING_KEY, JSON.stringify(state)); } catch { /* private mode: progress is just not kept */ }
}

export function useOnboarding(): { state: OnboardingState; mark: (def: Pick<OnboardingStepDef, 'id' | 'version'>, how: 'done' | 'skipped') => void } {
  const [state, setState] = useState<OnboardingState>(readOnboarding);
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === ONBOARDING_KEY) setState(readOnboarding()); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const mark = useCallback((def: Pick<OnboardingStepDef, 'id' | 'version'>, how: 'done' | 'skipped') => {
    setState((prev) => {
      const next = markOnboardingStep(prev, def, how, Date.now());
      writeOnboarding(next);
      return next;
    });
  }, []);
  return { state, mark };
}

/** For code outside React (e.g. the starter flow): record a step as done right away. */
export function markOnboardingDone(def: Pick<OnboardingStepDef, 'id' | 'version'>): void {
  writeOnboarding(markOnboardingStep(readOnboarding(), def, 'done', Date.now()));
}
