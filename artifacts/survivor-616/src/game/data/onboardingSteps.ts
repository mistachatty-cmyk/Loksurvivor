// The new-player checklist shown as a "What's next" chip in the hideout (standard: Lok-EcoSystsem docs/LOK_ONBOARDING_STANDARD.md).
// Steps use the shared SDK type so a later feature introduction is one more entry here, nothing else.
import type { OnboardingStepDef } from '../../../../../lib/lok-universe/src/onboarding';

export type HideoutOnboardingGoal = 'card-shop' | 'looks' | 'run' | 'account';

export interface HideoutOnboardingStep extends OnboardingStepDef {
  /** Where the chip button takes the player. */
  goal: HideoutOnboardingGoal;
}

export const HIDEOUT_ONBOARDING_STEPS: HideoutOnboardingStep[] = [
  // Only for players who have not finished a run yet, so returning players never see the first-day checklist.
  { id: 'first-packs', kind: 'choice', version: 1, priority: 0, goal: 'card-shop', when: (ctx) => ctx.totalRuns === 0 },
  { id: 'set-looks', kind: 'choice', version: 1, priority: 1, goal: 'looks', after: ['first-packs'], when: (ctx) => ctx.totalRuns === 0 },
  { id: 'first-run', kind: 'tutorial', version: 1, goal: 'run', when: (ctx) => ctx.totalRuns === 0, after: ['set-looks'] },
  { id: 'save-progress', kind: 'account', version: 1, goal: 'account', when: (ctx) => ctx.authAvailable === true && !ctx.signedIn, after: ['first-packs'] },
];
