/**
 * Device-local LokErrorReport choices for 616 Survivor (not part of the meta save):
 *   enabled  -- crash capture and the LokServer pop-up (default on)
 *   autoSend -- send each new crash to LOK without asking (default off: sending is the player's call)
 */
const ENABLED_KEY = 'survivor616.lokError.enabled';
const AUTO_SEND_KEY = 'survivor616.lokError.autoSend';
const CHANGE_EVENT = 'survivor616:lokError-setting';

function read(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string): void {
  try { window.localStorage.setItem(key, value); } catch { /* lasts until reload */ }
  try { window.dispatchEvent(new Event(CHANGE_EVENT)); } catch { /* no window */ }
}

export const getLokErrorEnabled = (): boolean => read(ENABLED_KEY) !== '0';
export const setLokErrorEnabled = (on: boolean): void => write(ENABLED_KEY, on ? '1' : '0');
export const getLokErrorAutoSend = (): boolean => read(AUTO_SEND_KEY) === '1';
export const setLokErrorAutoSend = (on: boolean): void => write(AUTO_SEND_KEY, on ? '1' : '0');

export function onLokErrorSettingChange(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}
