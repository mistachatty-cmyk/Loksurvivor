import { consoleProfile } from './core';

/**
 * Tag the page once at startup so CSS can adapt: `data-lok-console` and the `--lok-tv-inset`
 * variable (the title-safe margin as a percentage). Games opt in by using the variable; nothing
 * moves unless a layout reads it.
 */
export function applyConsoleProfile(): void {
  if (typeof document === 'undefined') return;
  const p = consoleProfile();
  const root = document.documentElement;
  if (p.kind === 'none') return;
  root.dataset.lokConsole = p.kind;
  root.style.setProperty('--lok-tv-inset', `${(p.safeInset * 100).toFixed(1)}%`);
}
