/**
 * Boost Jar chip and sheet for the Lok Shop (placeholder look: flat tube and level, no art approved yet).
 * The chip sits next to the owl; tapping it opens the sheet with the full jar. All numbers come from the server
 * (lok-jar), so what the player sees is what they will be paid. Nothing here auto-opens or nags.
 */
import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n';
import { useLokEconomy } from '@/state/lokEconomyStore';

const pct = (n: number) => `${Math.round(n * 100)}%`;
const clock = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');

function Tube({ level }: { level: number }) {
  return (
    <div className="relative h-24 w-10 shrink-0 overflow-hidden border border-cyan-300/60 bg-black/40" role="img" aria-label={pct(level)}>
      <div className="absolute inset-x-0 bottom-0 bg-cyan-300/70 transition-[height] duration-700 motion-reduce:transition-none" style={{ height: `${Math.round(Math.min(1, Math.max(0, level)) * 100)}%` }} />
    </div>
  );
}

export function LokJarChip({ onNotice }: { onNotice?: (text: string) => void }) {
  const t = useT();
  const { signedIn, jar, activateJar, refreshJar } = useLokEconomy();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    void refreshJar();
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, refreshJar]);

  // Stays hidden until the server answers, so nothing dead shows before the jar is switched on.
  const fill = jar?.fill ?? 0;
  const collect = () => {
    if (!jar || busy || !jar.can_activate) return;
    setBusy(true); setMsg(null);
    void activateJar().then((r) => {
      setBusy(false);
      if (r.ok) {
        const text = t('lokjar.done', { tokens: r.amount, pct: pct(r.pct ?? fill), mins: r.minutes ?? jar.minutes });
        setMsg(text); onNotice?.(text);
      } else if (r.error === 'network' || r.error === 'not_signed_in' || !('retry_at' in r) || !r.retry_at) {
        setMsg(t('lokjar.failed'));
      }
    });
  };

  const reason = jar && !jar.can_activate && jar.reason
    ? t(`lokjar.reason.${jar.reason}` as never, { time: clock(jar.reason === 'boost_running' ? jar.boost?.ends_at : jar.retry_at) })
    : null;

  if (!signedIn || !jar) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={t('lokjar.chipLabel', { pct: pct(fill) })} aria-haspopup="dialog"
        className="flex shrink-0 flex-col items-center gap-1 border border-cyan-300/50 px-2 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-200 hover:bg-cyan-300/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 active:translate-y-px" data-testid="button-lokjar-chip">
        <span className="relative block h-8 w-4 overflow-hidden border border-cyan-300/60 bg-black/40" aria-hidden="true">
          <span className="absolute inset-x-0 bottom-0 bg-cyan-300/70" style={{ height: `${Math.round((jar?.level ?? 0) * 100)}%` }} />
        </span>
        {t('lokjar.chip', { pct: pct(fill) })}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={() => setOpen(false)} data-testid="lokjar-backdrop">
          <section role="dialog" aria-modal="true" aria-label={t('lokjar.title')} onClick={(e) => e.stopPropagation()} className="lokshop-holo max-h-[85vh] w-full max-w-md overflow-y-auto p-4" data-testid="lokjar-sheet">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-black uppercase tracking-[0.2em] text-violet-200">{t('lokjar.title')}</h2>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label={t('lokjar.close')} className="border border-violet-300/40 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-violet-300/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" data-testid="button-lokjar-close">X</button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t('lokjar.intro')}</p>

            {(
              <>
                <div className="mt-4 flex items-center gap-4">
                  <Tube level={jar.level} />
                  <div className="min-w-0 text-sm">
                    <p className="font-mono text-[11px] uppercase tracking-widest text-cyan-300">{t('lokjar.holds', { pct: pct(fill) })}</p>
                    <ul className="mt-2 space-y-1">
                      {jar.games.map((g) => (
                        <li key={g.app} data-testid={`lokjar-game-${g.app}`}>
                          <span className="font-bold">{t(`lokjar.game.${g.app}` as never)}</span>{' '}
                          {t('lokjar.row', { n: g.count, unit: g.unit, pct: pct(g.bonus) })}
                          {g.next ? <span className="text-muted-foreground"> · {t('lokjar.next', { n: g.next.remaining, pct: pct(g.next.bonus) })}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{t('lokjar.preview', { tokens: jar.payout, pct: pct(fill), mins: jar.minutes })}</p>
                {reason ? <p className="mt-2 text-xs" data-testid="lokjar-reason">{reason}</p> : null}
                <button type="button" onClick={collect} disabled={busy || !jar.can_activate} aria-busy={busy}
                  className="mt-4 w-full border border-cyan-300 bg-cyan-300/15 px-3 py-2 font-mono text-xs font-bold uppercase tracking-widest text-cyan-100 hover:bg-cyan-300/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40" data-testid="button-lokjar-collect">
                  {busy ? t('lokjar.collecting') : t('lokjar.collect')}
                </button>
                {msg ? <p className="mt-3 text-sm" role="status" data-testid="lokjar-msg">{msg}</p> : null}
              </>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
