import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type TouchEvent } from 'react';

import { slideKind, swipeTargetId, type SlideKind } from '@/lib/screenSlide';

const BLOCKING = 'input,textarea,select,canvas,[data-no-swipe],[role="dialog"],[role="slider"],[contenteditable="true"]';
const OVERLAYS = '[role="dialog"],[aria-modal="true"],[data-testid="screen-hideout-arrival"]';

/** True when a touch begins somewhere a sideways drag already means something else. */
function swipeBlocked(target: EventTarget | null): boolean {
  if (typeof document === 'undefined') return true;
  if (document.querySelector(OVERLAYS)) return true;
  let el = target instanceof Element ? target : null;
  while (el && el !== document.body) {
    if (el.matches(BLOCKING)) return true;
    const style = window.getComputedStyle(el);
    if ((style.overflowX === 'auto' || style.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 2) return true;
    el = el.parentElement;
  }
  return false;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

/** The slide lasts well under this; it is only a safety net for a missed animation-end event. */
const SLIDE_GUARD_MS = 420;

interface Props {
  screenName: string;
  /** Pages make room under the persistent nav dock when it is showing. */
  dockVisible?: boolean;
  /** Finger swipes between dock pages only run while this is true (menus showing, no overlay up). */
  swipeEnabled: boolean;
  onSwipe: (pageId: string) => void;
  children: ReactNode;
}

/**
 * Wraps the current screen: a new screen slides in from the side its page sits on in the nav dock
 * (a soft rise for other screens), and a sideways swipe on a dock page walks to the next or previous
 * page. Enter-only on purpose: the old screen unmounts straight away, so canvas runs and audio never
 * linger behind an exit animation.
 */
export function ScreenSlide({ screenName, dockVisible = false, swipeEnabled, onSwipe, children }: Props) {
  const [state, setState] = useState<{ name: string; kind: SlideKind; animating: boolean }>({ name: screenName, kind: 'none', animating: false });
  // Derived during render: the kind is decided the moment the screen name changes, before first paint of the new screen.
  if (state.name !== screenName) {
    const kind = prefersReducedMotion() ? 'none' : slideKind(state.name, screenName);
    setState({ name: screenName, kind, animating: kind !== 'none' });
  }
  useEffect(() => {
    if (!state.animating) return;
    const id = window.setTimeout(() => setState((current) => (current.name === state.name ? { ...current, animating: false } : current)), SLIDE_GUARD_MS);
    return () => window.clearTimeout(id);
  }, [state.animating, state.name]);
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);

  const onTouchStart = (event: TouchEvent) => {
    touch.current = null;
    if (!swipeEnabled || event.touches.length !== 1) return;
    if (swipeBlocked(event.target)) return;
    const point = event.touches[0]!;
    touch.current = { x: point.clientX, y: point.clientY, t: Date.now() };
  };
  const onTouchEnd = (event: TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    const point = event.changedTouches[0];
    if (!start || !point || !swipeEnabled) return;
    const id = swipeTargetId(screenName, { dx: point.clientX - start.x, dy: point.clientY - start.y, ms: Date.now() - start.t });
    if (id) onSwipe(id);
  };

  // While sliding, the page is cropped to one screen tall. A long page (the card shop is over 11,000 px) animated whole
  // becomes one giant layer, which a phone browser can run out of memory on and close the tab.
  const style: CSSProperties = {};
  if (state.animating) {
    style.maxHeight = '100dvh';
    style.overflow = 'hidden';
  }
  if (dockVisible) style.padding = '0 0 var(--menu-dock-h, 0px) var(--menu-dock-w, 0px)';
  return (
    <div
      key={screenName}
      style={style}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) setState((current) => ({ ...current, animating: false }));
      }}
      className={state.kind === 'none' ? undefined : `screen-slide screen-slide-${state.kind}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => {
        touch.current = null;
      }}
      data-testid="screen-slide"
    >
      {children}
    </div>
  );
}

export default ScreenSlide;
