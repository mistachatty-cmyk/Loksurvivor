import { useLayoutEffect, useRef, type ReactNode } from 'react';

const FOCUSABLE = 'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';

/** Contain keyboard focus in a custom modal and restore the actual launcher on close. */
export function ModalFocus({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const scope = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const root = scope.current!;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const controls = () => Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.getClientRects().length > 0 && !el.closest('[inert],[aria-hidden="true"]'));
    const first = () => { const items = controls(); return items.find(el => el instanceof HTMLInputElement) ?? items[0]; };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); close.current();
      } else if (event.key === 'Tab') {
        const items = controls(), start = items[0], end = items[items.length - 1];
        if (!start || !end) { event.preventDefault(); return; }
        if (!root.contains(document.activeElement) || (event.shiftKey ? document.activeElement === start : document.activeElement === end)) {
          event.preventDefault(); (event.shiftKey ? end : start).focus();
        }
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !root.contains(event.target)) first()?.focus();
    };
    first()?.focus();
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocus);
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return <div ref={scope} className="contents">{children}</div>;
}
