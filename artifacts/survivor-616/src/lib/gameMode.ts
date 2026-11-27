/**
 * Game Mode: one in-app switch for "use the whole screen and stop the page from getting in the way".
 *
 * Why it exists: browsers (and their gaming overlays) can park keyboard focus on their own
 * fullscreen button, so arrow keys never reach the game. Game Mode does the fullscreen request
 * itself from a real gesture, drops stray focus, locks page scroll and tells the player how to
 * leave. It is shared by every Lok screen; see docs/LOK_GAME_MODE.md for the design rules.
 *
 * Pure browser plumbing: no network, no storage, nothing to pay for.
 */

import { useCallback, useEffect, useState } from 'react';

export interface GameModeApi {
  /** False on browsers with no Fullscreen API (iPhone Safari): the button hides itself. */
  supported: boolean;
  active: boolean;
  enter: () => Promise<void>;
  exit: () => Promise<void>;
  toggle: () => Promise<void>;
}

function canFullscreen(): boolean {
  return typeof document !== 'undefined' && Boolean(document.fullscreenEnabled) && typeof document.documentElement.requestFullscreen === 'function';
}

/** Drop focus from whatever button was last pressed so arrow keys and Space reach the game. */
export function releaseFocus(): void {
  try {
    (document.activeElement as HTMLElement | null)?.blur?.();
  } catch {
    /* nothing to release */
  }
}

export function useGameMode(): GameModeApi {
  const [active, setActive] = useState(() => typeof document !== 'undefined' && Boolean(document.fullscreenElement));
  const supported = canFullscreen();

  useEffect(() => {
    const update = () => {
      setActive(Boolean(document.fullscreenElement));
      releaseFocus();
    };
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  const enter = useCallback(async () => {
    if (!canFullscreen() || document.fullscreenElement) return;
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      /* the browser said no; the button simply stays in its off state */
    }
    releaseFocus();
  }, []);

  const exit = useCallback(async () => {
    if (!document.fullscreenElement) return;
    try {
      await document.exitFullscreen();
    } catch {
      /* already leaving */
    }
    releaseFocus();
  }, []);

  const toggle = useCallback(async () => {
    if (document.fullscreenElement) await exit();
    else await enter();
  }, [enter, exit]);

  return { supported, active, enter, exit, toggle };
}
