/**
 * Generic unlock/achievement announcement toasts. Renders whatever is
 * currently queued in `MetaState.pendingNotifications` (see `metaStore.tsx`)
 * and drains each entry a few seconds after it's shown, or immediately on
 * click. Deliberately generic -- a future unlock trigger only needs to push
 * another `PendingNotification` into the queue, never touch this file.
 */
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useMeta } from '@/game/state/metaStore';
import { ALL_WEAPON_DEFS } from '@/game/data/weaponPixelModels';
import { prefersReducedMotion } from '@/anim/motion';
import { WeaponIcon } from './WeaponIcon';
import { useT, type MessageKey } from '@/lib/i18n';

const AUTO_DISMISS_MS = 6000;
/** More than this at once would cover the screen; the rest wait in the Mailbox. */
const MAX_VISIBLE = 3;
const BOUNCE = { type: 'spring', stiffness: 420, damping: 17, mass: 0.8 } as const;

export function NotificationToasts() {
  const t = useT();
  const { meta, dismissNotifications } = useMeta();
  const notifications = meta.pendingNotifications;
  const reduced = prefersReducedMotion();
  const scheduled = useRef(new Map<string, number>());
  // While the arrival scene or a full-screen notice covers the hub the toasts wait, so their timers do not burn unseen.
  const [covered, setCovered] = useState(() => typeof document !== 'undefined' && document.body.hasAttribute('data-hide-dock'));
  useEffect(() => {
    const sync = () => setCovered(document.body.hasAttribute('data-hide-dock'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-hide-dock'] });
    return () => observer.disconnect();
  }, []);

  // One timer per toast, so a new arrival never resets or cuts short the others.
  useEffect(() => {
    if (covered) return;
    const live = new Set(notifications.map((n) => n.id));
    for (const [id, timer] of scheduled.current) {
      if (!live.has(id)) { window.clearTimeout(timer); scheduled.current.delete(id); }
    }
    notifications.slice(-MAX_VISIBLE).forEach((n) => {
      if (scheduled.current.has(n.id)) return;
      scheduled.current.set(n.id, window.setTimeout(() => { scheduled.current.delete(n.id); dismissNotifications([n.id]); }, AUTO_DISMISS_MS));
    });
  }, [notifications, dismissNotifications, covered]);
  useEffect(() => () => { for (const timer of scheduled.current.values()) window.clearTimeout(timer); scheduled.current.clear(); }, []);

  if (covered) return null;
  const visible = notifications.slice(-MAX_VISIBLE);
  const hidden = notifications.length - visible.length;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top,0px)+0.5rem)] z-[170] flex flex-col items-center gap-2 px-3"
      data-testid="notification-toast-stack"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {visible.map((notification) => {
          const weapon = notification.iconId ? ALL_WEAPON_DEFS.find((candidate) => candidate.id === notification.iconId) : undefined;
          return (
            <motion.button
              key={notification.id}
              layout={!reduced}
              type="button"
              onClick={() => dismissNotifications([notification.id])}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: -46, scale: 0.88 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -20, scale: 0.94, transition: { duration: 0.18 } }}
              transition={BOUNCE}
              whileTap={reduced ? undefined : { scale: 0.96 }}
              className="pointer-events-auto relative flex w-full max-w-md items-start gap-3 overflow-hidden rounded-xl border border-primary/45 bg-black/90 px-4 py-3 text-left shadow-[0_12px_30px_-12px_rgba(0,0,0,.9)] backdrop-blur"
              data-testid={`notification-toast-${notification.id}`}
            >
              <motion.span
                className="mt-0.5 shrink-0"
                initial={reduced ? false : { scale: 0, rotate: -40 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ ...BOUNCE, delay: 0.08 }}
              >
                {weapon
                  ? <WeaponIcon kind={weapon.kind} weaponId={weapon.id} color={weapon.color} size={30} label={weapon.name} />
                  : <Sparkles className="h-4 w-4 text-primary" />}
              </motion.span>
              <span className="min-w-0">
                <span className="block font-mono text-[10px] font-bold uppercase tracking-widest text-primary">{notification.titleKey ? t(notification.titleKey as MessageKey, notification.variables) : notification.title}</span>
                <span className="block text-xs leading-snug text-white">{notification.bodyKey ? t(notification.bodyKey as MessageKey, notification.variables) : notification.body}</span>
              </span>
              {reduced ? null : <span className="toast-timer" style={{ animationDuration: `${AUTO_DISMISS_MS}ms` }} aria-hidden="true" />}
            </motion.button>
          );
        })}
      </AnimatePresence>
      {hidden > 0 ? (
        <motion.p layout={!reduced} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={BOUNCE} className="pointer-events-none rounded-full border border-white/15 bg-black/80 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-white/70" data-testid="notification-toast-more">
          {t('notice.moreInMailbox', { n: hidden })}
        </motion.p>
      ) : null}
    </div>
  );
}
