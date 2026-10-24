import { useEffect, useState, type RefObject } from 'react';

/**
 * True while the element is on screen or within `margin` pixels of it. Long menus (the card shop
 * binder draws 70+ animated portraits) use this to draw and animate only what can be seen, and to
 * hand the canvas memory back for the rest. Without IntersectionObserver everything counts as near.
 */
export function useNearViewport(ref: RefObject<Element | null>, margin = 240): boolean {
  const supported = typeof IntersectionObserver !== 'undefined';
  const [near, setNear] = useState(!supported);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) setNear(entry.isIntersecting);
    }, { rootMargin: `${margin}px 0px` });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, margin]);
  return near;
}
