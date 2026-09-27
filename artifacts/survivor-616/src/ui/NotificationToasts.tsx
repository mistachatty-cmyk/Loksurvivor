/**
 * Generic unlock/achievement announcement toasts. Renders whatever is
 * currently queued in `MetaState.pendingNotifications` (see `metaStore.tsx`)
 * and drains each entry a few seconds after it's shown, or immediately on
 * click. Deliberately generic -- a future unlock trigger only needs to push
 * another `PendingNotification` into the queue, never touch this file.
 */
import { useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { useMeta } from '@/game/state/metaStore';

const AUTO_DISMISS_MS = 6000;

export function NotificationToasts() {
  const { meta, dismissNotifications } = useMeta();
  const notifications = meta.pendingNotifications;

  useEffect(() => {
    if (notifications.length === 0) return;
    const timer = window.setTimeout(() => {
      dismissNotifications(notifications.map((n) => n.id));
    }, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [notifications, dismissNotifications]);

  if (notifications.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4"
      data-testid="notification-toast-stack"
    >
      {notifications.map((notification) => (
        <button
          key={notification.id}
          type="button"
          onClick={() => dismissNotifications([notification.id])}
          className="pointer-events-auto flex w-full max-w-md items-start gap-3 border border-primary/40 bg-black/90 px-4 py-3 text-left shadow-lg backdrop-blur"
          data-testid={`notification-toast-${notification.id}`}
        >
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0">
            <span className="block font-mono text-[10px] font-bold uppercase tracking-widest text-primary">{notification.title}</span>
            <span className="block text-xs leading-snug text-white">{notification.body}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
