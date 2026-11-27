/**
 * Survivor 616's hookup for two Lok ecosystem baselines from the shared SDK:
 * - the fullscreen / pop-out button (screen.ts), and
 * - controllers (gamepad.ts): the shared poller that Lok Party minigames read. Menu navigation in 616
 *   comes from consolePad.ts, and minigames switch it off with setPadGameplay while you play.
 */

import { lokPad } from '../../../../lib/lok-universe/src/gamepad';
import { mountScreenButton, popoutKind, SCREEN_AWAY_EVENT, SCREEN_BACK_EVENT, type ScreenButtonHandle } from '../../../../lib/lok-universe/src/screen';
import { t } from '@/lib/i18n';

let handle: ScreenButtonHandle | null = null;

function toast(message: string) {
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.textContent = message;
  el.style.cssText = 'position:fixed;left:50%;bottom:max(24px,env(safe-area-inset-bottom));transform:translateX(-50%);max-width:min(92vw,420px);padding:12px 16px;background:#07061a;border:2px solid #38f2ff;color:#fff;font:600 14px system-ui,sans-serif;text-align:center;z-index:2147483600';
  document.body.append(el);
  window.setTimeout(() => el.remove(), 4200);
}

const labels = () => ({
  enterFullscreen: t('screen.enter'),
  exitFullscreen: t('screen.exit'),
  popOut: t('screen.popOut'),
  bringBack: t('screen.bringBack'),
  poppedOut: t('screen.poppedOut'),
  homeScreenHint: t('screen.homeScreenHint'),
  notAllowed: t('screen.notAllowed'),
});

/** The settings page's "Try it now": the same action as the floating button. */
export function pressScreenButton(): Promise<void> {
  return handle?.press() ?? Promise.resolve();
}

export function startLokScreenAndPad(): void {
  if (typeof window === 'undefined' || handle) return;
  handle = mountScreenButton({ labels: labels(), notify: toast });
  // Menus are driven by consolePad.ts here; the shared poller only feeds Lok Party minigames.
  lokPad.start();
  // A separate pop-out window runs its own copy of the game: this page goes quiet meanwhile.
  window.addEventListener(SCREEN_AWAY_EVENT, () => {
    if (popoutKind() === 'window') document.documentElement.setAttribute('data-lok-away', '');
  });
  window.addEventListener(SCREEN_BACK_EVENT, () => document.documentElement.removeAttribute('data-lok-away'));
}
