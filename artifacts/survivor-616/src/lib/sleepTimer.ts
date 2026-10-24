/** Sleep timer steps for the Jukebox Room: off, then 15, 30, 60 and 90 minutes. Pure so it can be tested. */
export const SLEEP_STEPS_MIN: readonly number[] = [0, 15, 30, 60, 90];

/** The next step when the button is pressed, wrapping back to off. */
export function nextSleepStep(currentMin: number): number {
  const at = SLEEP_STEPS_MIN.indexOf(currentMin);
  if (at < 0) return SLEEP_STEPS_MIN[1] ?? 0;
  return SLEEP_STEPS_MIN[(at + 1) % SLEEP_STEPS_MIN.length] ?? 0;
}

/** "14:05" style countdown. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? `0${s}` : s}`;
}
