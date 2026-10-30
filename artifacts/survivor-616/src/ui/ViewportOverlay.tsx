import { useLayoutEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Above screen transforms and navigation, while retaining the active theme's variables. */
export function overlayContainer() {
  return document.getElementById('viewport-overlays') ?? document.body;
}

export function ViewportOverlay({ children }: { children: ReactNode }) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => { setContainer(overlayContainer()); }, []);
  return container ? createPortal(children, container) : null;
}
