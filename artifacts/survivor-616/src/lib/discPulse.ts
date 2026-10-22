/** How strongly the floating discs pulse to the music. Device-local, like the other disc settings. */
export type DiscPulseLevel = 'off' | 'soft' | 'full';

const KEY = 'survivor616.disc-pulse.v1';
export const DISC_PULSE_LEVELS: readonly DiscPulseLevel[] = ['off', 'soft', 'full'] as const;

export function readDiscPulse(): DiscPulseLevel {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw === 'off' || raw === 'soft' || raw === 'full' ? raw : 'full';
  } catch {
    return 'full';
  }
}

export function writeDiscPulse(level: DiscPulseLevel): void {
  try {
    window.localStorage.setItem(KEY, level);
  } catch {
    /* storage blocked: the choice just will not persist */
  }
}
