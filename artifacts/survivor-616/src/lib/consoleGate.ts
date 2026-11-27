/**
 * Xbox Edge starts with the controller acting as a mouse: sticks move a cursor and
 * scroll or zoom the page, so no game can read them properly. The page cannot
 * force the switch, so say how, once, and get out of the way when real controller
 * input arrives.
 */
import { isXboxBrowser, lokPad } from '../../../../lib/lok-universe/src/gamepad';
import { t } from '@/lib/i18n';

const SEEN = 'survivor616.console-gate';

export function startConsoleGate(): void {
  if (!isXboxBrowser()) return;
  try { if (window.sessionStorage.getItem(SEEN)) return; } catch { /* show it */ }

  const card = document.createElement('div');
  card.dataset.testid = 'console-gate';
  card.setAttribute('role', 'status');
  card.style.cssText = 'position:fixed;left:50%;top:24px;transform:translateX(-50%);width:min(92vw,560px);padding:20px 24px;background:#07061a;border:3px solid #38f2ff;color:#fff;font:600 20px/1.4 system-ui,sans-serif;text-align:center;z-index:2147483600';
  const title = document.createElement('strong');
  title.textContent = t('console.title');
  const body = document.createElement('p');
  body.textContent = t('console.body');
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.textContent = t('console.dismiss');
  skip.style.cssText = 'margin-top:8px;padding:10px 18px;border:2px solid #fff;background:transparent;color:#fff;font:inherit';
  card.append(title, body, skip);
  document.body.append(card);

  let off = () => {};
  const done = () => {
    off();
    card.remove();
    try { window.sessionStorage.setItem(SEEN, '1'); } catch { /* shows again next load */ }
  };
  skip.addEventListener('click', done);
  // A button reaching the page as a controller button means game controls are on.
  off = lokPad.subscribe((frame) => { if (frame.pressed.size > 0) done(); });
}
