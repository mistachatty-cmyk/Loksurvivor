import { useEffect, useState } from 'react';
import { Bell, Check, Mail, Trash2, X } from 'lucide-react';

import { ALL_WEAPON_DEFS } from '@/game/data/weaponPixelModels';
import { useMeta } from '@/game/state/metaStore';
import { useT, type MessageKey } from '@/lib/i18n';
import { WeaponIcon } from './WeaponIcon';

export function NotificationMailbox() {
  const t = useT();
  const { meta, markTrainingMailboxRead, keepTrainingMailboxEntry, deleteTrainingMailboxEntry } = useMeta();
  const [open, setOpen] = useState(false);
  const unread = meta.trainingMailbox.filter((entry) => !entry.read).length;

  useEffect(() => {
    if (!open) return;
    for (const entry of meta.trainingMailbox) if (!entry.read) markTrainingMailboxRead(entry.id);
  }, [open, meta.trainingMailbox, markTrainingMailboxRead]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="fixed bottom-20 right-3 z-[80] inline-flex min-h-10 items-center gap-2 border border-cyan-200/45 bg-slate-950/95 px-3 font-mono text-[9px] font-black uppercase tracking-widest text-cyan-100 shadow-lg hover:bg-cyan-950/90 sm:bottom-4 sm:right-4" aria-label={t('training.mailbox.open')} data-testid="button-notification-mailbox">
        <Mail size={15} />{t('training.mailbox.label')}
        {unread > 0 && <span className="min-w-5 rounded-full bg-rose-500 px-1.5 py-0.5 text-center text-[9px] text-white" aria-label={t('training.mailbox.unread', { n: unread })}>{unread}</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="flex max-h-[85dvh] w-full max-w-xl flex-col border border-cyan-200/40 bg-slate-950 text-slate-100 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="training-mailbox-title" data-testid="training-mailbox-dialog">
            <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2"><Bell size={16} className="text-cyan-200" /><div><h2 id="training-mailbox-title" className="font-mono text-xs font-black uppercase tracking-widest">{t('training.mailbox.title')}</h2><p className="mt-1 text-[10px] text-white/50">{t('training.mailbox.subtitle')}</p></div></div>
              <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center border border-white/15 hover:bg-white/10" aria-label={t('training.mailbox.close')}><X size={16} /></button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {meta.trainingMailbox.length === 0 ? <p className="p-8 text-center text-xs text-white/45">{t('training.mailbox.empty')}</p> : (
                <ul className="grid gap-2">
                  {[...meta.trainingMailbox].reverse().map((entry) => {
                    const weapon = entry.iconId ? ALL_WEAPON_DEFS.find((candidate) => candidate.id === entry.iconId) : undefined;
                    return (
                      <li key={entry.id} className={`border p-3 ${entry.kept ? 'border-amber-200/35 bg-amber-200/[.04]' : 'border-white/10 bg-white/[.025]'}`} data-testid={`training-mail-${entry.id}`}>
                        <div className="flex items-start gap-3">
                          {weapon ? <WeaponIcon kind={weapon.kind} weaponId={weapon.id} color={weapon.color} size={34} label={weapon.name} /> : <Bell className="mt-1 h-5 w-5 shrink-0 text-cyan-200" aria-hidden="true" />}
                          <div className="min-w-0 flex-1"><p className="font-mono text-[10px] font-black uppercase tracking-wider text-cyan-100">{entry.titleKey ? t(entry.titleKey as MessageKey, entry.variables) : entry.title}</p><p className="mt-1 text-xs leading-relaxed text-white/75">{entry.bodyKey ? t(entry.bodyKey as MessageKey, entry.variables) : entry.body}</p><time className="mt-2 block font-mono text-[9px] text-white/35">{new Date(entry.createdAt).toLocaleString()}</time></div>
                          {entry.kept && <Check size={15} className="shrink-0 text-amber-200" aria-label={t('training.mailbox.kept')} />}
                        </div>
                        <div className="mt-2 flex justify-end gap-2 border-t border-white/10 pt-2">
                          <button type="button" onClick={() => keepTrainingMailboxEntry(entry.id, !entry.kept)} className="inline-flex min-h-8 items-center gap-1 border border-amber-200/25 px-2 text-[9px] font-bold uppercase text-amber-100 hover:bg-amber-100/10" aria-pressed={entry.kept}>{entry.kept ? t('training.mailbox.unkeep') : t('training.mailbox.keep')}</button>
                          <button type="button" onClick={() => deleteTrainingMailboxEntry(entry.id)} className="inline-flex min-h-8 items-center gap-1 border border-rose-300/25 px-2 text-[9px] font-bold uppercase text-rose-100 hover:bg-rose-100/10"><Trash2 size={12} />{t('training.mailbox.delete')}</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
