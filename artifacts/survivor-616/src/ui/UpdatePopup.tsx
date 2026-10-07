/**
 * The big "what's new" popup -- shown once, the first time a player loads
 * the Hub after `CURRENT_VERSION` (see `data/changelog.ts`) moves past
 * `meta.lastSeenChangelogVersion`. Modeled on the classic "new version"
 * splash a lot of live-service games show on launch: blocking, a little
 * loud, signed by a rotating "sponsor" credit (see `data/creditRotation.ts`
 * -- sometimes this game's own name, sometimes the studio, sometimes a
 * sibling IP, picked once per mount). Dismissing it marks every
 * currently-unseen entry as seen at once (`acknowledgeChangelog`), so it
 * never reappears until the next real update ships.
 */
import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, X } from 'lucide-react';
import { useMeta } from '@/game/state/metaStore';
import { CHANGELOG, CURRENT_VERSION, changelogEntriesSince, updateNumber } from '@/game/data/changelog';
import { CHANGELOG_KIND_META, visibleUpdatePopupEntries } from '@/game/data/changelogKinds';
import { pickCreditName } from '@/game/data/creditRotation';
import { prefersReducedMotion as prefersReducedMotionNow } from '@/anim/motion';
import { UpdateEntryCard } from './UpdateEntryCard';

export function UpdatePopup() {
  const { meta, acknowledgeChangelog } = useMeta();
  const unseen = changelogEntriesSince(meta.lastSeenChangelogVersion);
  const visible = visibleUpdatePopupEntries(unseen, meta.updatePopupKinds);
  // Picked once per mount, not per render -- see data/creditRotation.ts.
  const credit = useMemo(() => pickCreditName(), []);

  useEffect(() => {
    if (unseen.length > 0 && visible.length === 0) acknowledgeChangelog();
  }, [unseen.length, visible.length, acknowledgeChangelog]);

  if (visible.length === 0) return null;

  const prefersReducedMotion = prefersReducedMotionNow();
  const latestKind = CHANGELOG_KIND_META[visible[visible.length - 1]!.kind];

  return (
    <div
      className="fixed inset-0 z-[150] grid place-items-center overflow-y-auto bg-black/90 p-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Game update"
      data-testid="section-update-popup"
    >
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
        className="relative w-full max-w-lg border-2 bg-black p-5"
        style={{ borderColor: `${latestKind.color}99`, backgroundImage: `linear-gradient(to bottom, ${latestKind.color}33, #000)`, boxShadow: `0 0 60px ${latestKind.color}33` }}
      >
        <button
          type="button"
          onClick={acknowledgeChangelog}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center border border-white/20 bg-black/70 text-white transition-all active:scale-[0.97] hover:border-white/50"
          aria-label="Dismiss update notice"
          data-testid="button-close-update-popup"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          <Megaphone className="h-6 w-6 shrink-0" style={{ color: latestKind.color }} />
          <div>
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: latestKind.color }}>
              A Message From {credit}
            </p>
            <h2 className="text-2xl font-black uppercase text-white">Game Updated!</h2>
          </div>
        </div>
        <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Now on v{CURRENT_VERSION} · Update #{updateNumber(CHANGELOG[CHANGELOG.length - 1]!)}
        </p>

        <div className="mt-4 max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          {visible.map((entry) => <UpdateEntryCard key={entry.version} entry={entry} testId={`update-popup-entry-${entry.version}`} />)}
        </div>

        <button
          type="button"
          onClick={acknowledgeChangelog}
          className="mt-4 w-full border py-3 text-sm font-black uppercase tracking-widest transition-opacity hover:opacity-80"
          style={{ borderColor: latestKind.color, backgroundColor: `${latestKind.color}26`, color: latestKind.color }}
          data-testid="button-acknowledge-update"
        >
          Let's Go
        </button>
      </motion.div>
    </div>
  );
}
