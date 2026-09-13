/**
 * Short vibration feedback on key run moments (level-up, run end).
 *
 * Deliberately dumb: `vibrate()` never reads `MetaState` itself -- the caller
 * checks `meta.hapticsEnabled` before calling, same as `useGyroInput` takes
 * its options from the caller rather than reaching into meta. No permission
 * prompt is involved (unlike `gyro.ts`'s `requestGyroPermission`), and the
 * call is a silent no-op on any device without `navigator.vibrate`.
 */

export function hapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

export function vibrate(pattern: number | number[]): void {
  if (!hapticsSupported()) return;
  navigator.vibrate(pattern);
}
