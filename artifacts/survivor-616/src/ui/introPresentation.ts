import type { IntroPhysicsProfile } from '@/ui/introPhysics';

export type IntroEvent = 'none' | 'blackout' | 'chromatic-drift' | 'low-gravity' | 'static-bloom';

const THEME_PHYSICS: Record<string, Partial<IntroPhysicsProfile>> = {
  arcade: { restitution: 0.82, gravity: 190 },
  'night-drive': { restitution: 0.66, airDrag: 0.994 },
  'pothole-oracle': { restitution: 0.6, gravity: 255 },
  'mall-ghost': { gravity: 155, angularDrag: 0.992 },
  'weather-radio': { restitution: 0.76, angularDrag: 0.98 },
  'salvage-terminal': { restitution: 0.58, gravity: 275 },
  'river-dawn': { gravity: 175, returnDamping: 9.4 },
  'block-party': { restitution: 0.88, angularDrag: 0.982 },
  'signal-garden': { gravity: 145, airDrag: 0.995 },
  'night-bus': { restitution: 0.64, gravity: 235 },
  'impossible-manual': { restitution: 0.8, returnStrength: 27 },
};

export function introPhysicsForTheme(themeId: string, event: IntroEvent): Partial<IntroPhysicsProfile> {
  const profile = { ...(THEME_PHYSICS[themeId] ?? {}) };
  if (event === 'low-gravity') return { ...profile, gravity: 72, restitution: 0.86, airDrag: 0.996 };
  return profile;
}

/** Rare by design: the intro should still feel familiar most of the time. */
export function pickIntroEvent(random = Math.random()): IntroEvent {
  if (random < 0.025) return 'blackout';
  if (random < 0.05) return 'chromatic-drift';
  if (random < 0.075) return 'low-gravity';
  if (random < 0.1) return 'static-bloom';
  return 'none';
}

export function resolveIntroEvent(): IntroEvent {
  if (typeof window === 'undefined') return 'none';
  const storageKey = 'survivor616:intro-event';
  try {
    const cached = window.sessionStorage.getItem(storageKey) as IntroEvent | null;
    if (cached) return cached;
    const event = pickIntroEvent();
    window.sessionStorage.setItem(storageKey, event);
    return event;
  } catch {
    return pickIntroEvent();
  }
}
