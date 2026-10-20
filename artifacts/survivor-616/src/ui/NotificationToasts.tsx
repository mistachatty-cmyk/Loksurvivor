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
import { ALL_WEAPON_DEFS } from '@/game/data/weaponPixelModels';
import { WeaponIcon } from './WeaponIcon';
import { useT, type MessageKey } from '@/lib/i18n';

const AUTO_DISMISS_MS = 6000;

export function NotificationToasts() {
  const t = useT();
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
      className="pointer-events-none fixed inset-x-0 top-48 z-[100] flex max-h-[40vh] flex-col items-center gap-2 overflow-y-auto px-4 sm:top-40 lg:top-24"
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
          {notification.iconId && ALL_WEAPON_DEFS.find((weapon) => weapon.id === notification.iconId)
            ? (() => { const weapon = ALL_WEAPON_DEFS.find((candidate) => candidate.id === notification.iconId)!; return <WeaponIcon kind={weapon.kind} weaponId={notification.iconId} color={weapon.color} size={30} label={weapon.name} />; })()
            : <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
          <span className="min-w-0">
            <span className="block font-mono text-[10px] font-bold uppercase tracking-widest text-primary">{notification.titleKey ? t(notification.titleKey as MessageKey, notification.variables) : notification.title}</span>
            <span className="block text-xs leading-snug text-white">{notification.bodyKey ? t(notification.bodyKey as MessageKey, notification.variables) : notification.body}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
