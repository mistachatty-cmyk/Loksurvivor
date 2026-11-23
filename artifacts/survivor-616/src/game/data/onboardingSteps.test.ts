import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EMPTY_ONBOARDING_STATE, markOnboardingStep, nextOnboardingStep, validateOnboardingSteps } from '../../../../../lib/lok-universe/src/onboarding';
import { HIDEOUT_ONBOARDING_STEPS } from './onboardingSteps';

const ctx = (over: Record<string, unknown> = {}) => ({ signedIn: false, sessions: 0, canInterrupt: true, totalRuns: 0, authAvailable: true, ...over });

test('the hideout step list is valid', () => {
  assert.doesNotThrow(() => validateOnboardingSteps(HIDEOUT_ONBOARDING_STEPS));
});

test('a new player is walked through packs, looks, the account offer, then the first run (the standard puts account before tutorial)', () => {
  let state = EMPTY_ONBOARDING_STATE;
  const seen: string[] = [];
  for (let i = 0; i < 8; i += 1) {
    const next = nextOnboardingStep(HIDEOUT_ONBOARDING_STEPS, state, ctx());
    if (!next) break;
    seen.push(next.id);
    state = markOnboardingStep(state, next, 'done', i);
  }
  assert.deepEqual(seen, ['first-packs', 'set-looks', 'save-progress', 'first-run']);
});

test('the first-run step disappears once a run is finished and the account step needs sign-in to be available', () => {
  const done = ['first-packs', 'set-looks'].reduce((s, id) => markOnboardingStep(s, { id, version: 1 }, 'done', 1), EMPTY_ONBOARDING_STATE);
  assert.equal(nextOnboardingStep(HIDEOUT_ONBOARDING_STEPS, done, ctx({ totalRuns: 3, authAvailable: false })), null);
  assert.equal(nextOnboardingStep(HIDEOUT_ONBOARDING_STEPS, done, ctx({ totalRuns: 3 }))?.id, 'save-progress');
  assert.equal(nextOnboardingStep(HIDEOUT_ONBOARDING_STEPS, done, ctx({ totalRuns: 3, signedIn: true })), null);
});
