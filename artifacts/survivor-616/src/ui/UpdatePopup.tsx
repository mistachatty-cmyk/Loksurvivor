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
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, Wrench, X } from 'lucide-react';
import { useMeta } from '@/game/state/metaStore';
import { CHANGELOG, CURRENT_VERSION, changelogEntriesSince, updateNumber } from '@/game/data/changelog';
import { pickCreditName } from '@/game/data/creditRotation';

export function UpdatePopup() {
  const { meta, acknowledgeChangelog } = useMeta();
  const unseen = changelogEntriesSince(meta.lastSeenChangelogVersion);
  // Picked once per mount, not per render -- see data/creditRotation.ts.
  const credit = useMemo(() => pickCreditName(), []);

  if (unseen.length === 0) return null;

  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
        className="relative w-full max-w-lg border-2 border-cyan-300/50 bg-gradient-to-b from-cyan-950/40 to-black p-5 shadow-[0_0_60px_rgba(103,232,249,0.15)]"
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
          <Megaphone className="h-6 w-6 shrink-0 text-cyan-300" />
          <div>
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.25em] text-cyan-300">
              A Message From {credit}
            </p>
            <h2 className="text-2xl font-black uppercase text-white">Game Updated!</h2>
          </div>
        </div>
        <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Now on v{CURRENT_VERSION} · Update #{updateNumber(CHANGELOG[CHANGELOG.length - 1]!)}
        </p>

        <div className="mt-4 max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          {unseen.map((entry) => (
            <div
              key={entry.version}
              className={`border p-3 ${entry.kind === 'hotfix' ? 'border-amber-400/40 bg-amber-400/5' : 'border-cyan-300/25 bg-cyan-300/5'}`}
              data-testid={`update-popup-entry-${entry.version}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[8px] font-black uppercase tracking-widest ${
                    entry.kind === 'hotfix'
                      ? 'border-amber-400/60 bg-amber-400/15 text-amber-300'
                      : 'border-cyan-300/60 bg-cyan-300/15 text-cyan-200'
                  }`}
                >
                  {entry.kind === 'hotfix' ? <Wrench className="h-2.5 w-2.5" /> : <Megaphone className="h-2.5 w-2.5" />}
                  {entry.kind === 'hotfix' ? 'Hotfix' : 'Update'} #{updateNumber(entry)}
                </span>
                <span className="font-mono text-[9px] text-muted-foreground">v{entry.version} · {entry.date}</span>
              </div>
              <h3 className="mt-1.5 text-sm font-black uppercase text-white">{entry.title}</h3>
              <ul className="mt-1.5 space-y-1">
                {entry.body.map((line) => (
                  <li key={line} className="text-xs leading-snug text-muted-foreground">{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={acknowledgeChangelog}
          className="mt-4 w-full border border-cyan-300/60 bg-cyan-300/15 py-3 text-sm font-black uppercase tracking-widest text-cyan-100 transition-colors hover:bg-cyan-300/25"
          data-testid="button-acknowledge-update"
        >
          Let's Go
        </button>
      </motion.div>
    </div>
  );
}
