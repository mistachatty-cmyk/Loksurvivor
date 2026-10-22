import { useEffect } from 'react';
import { Bell, Check, Trash2 } from 'lucide-react';

import { ALL_WEAPON_DEFS } from '@/game/data/weaponPixelModels';
import { useMeta } from '@/game/state/metaStore';
import { useT, type MessageKey } from '@/lib/i18n';
import { WeaponIcon } from './WeaponIcon';

/**
 * The mailbox list: training notes, finds, and every toast that has been dismissed. It lives inside
 * LOK Chat now (the old floating Mailbox button is gone). Showing it marks everything read.
 */
export function MailboxPanel() {
  const t = useT();
  const { meta, markTrainingMailboxRead, keepTrainingMailboxEntry, deleteTrainingMailboxEntry } = useMeta();

  useEffect(() => {
    for (const entry of meta.trainingMailbox) if (!entry.read) markTrainingMailboxRead(entry.id);
  }, [meta.trainingMailbox, markTrainingMailboxRead]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3" data-testid="training-mailbox-dialog">
      {meta.trainingMailbox.length === 0 ? (
        <p className="p-8 text-center text-xs text-white/45">{t('training.mailbox.empty')}</p>
      ) : (
        <ul className="grid gap-2">
          {[...meta.trainingMailbox].reverse().map((entry) => {
            const weapon = entry.iconId ? ALL_WEAPON_DEFS.find((candidate) => candidate.id === entry.iconId) : undefined;
            return (
              <li key={entry.id} className={`border p-3 ${entry.kept ? 'border-amber-200/35 bg-amber-200/[.04]' : 'border-white/10 bg-white/[.025]'}`} data-testid={`training-mail-${entry.id}`}>
                <div className="flex items-start gap-3">
                  {weapon ? <WeaponIcon kind={weapon.kind} weaponId={weapon.id} color={weapon.color} size={34} label={weapon.name} /> : <Bell className="mt-1 h-5 w-5 shrink-0 text-cyan-200" aria-hidden="true" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[10px] font-black uppercase tracking-wider text-cyan-100">{entry.titleKey ? t(entry.titleKey as MessageKey, entry.variables) : entry.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/75">{entry.bodyKey ? t(entry.bodyKey as MessageKey, entry.variables) : entry.body}</p>
                    <time className="mt-2 block font-mono text-[9px] text-white/35">{new Date(entry.createdAt).toLocaleString()}</time>
                  </div>
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
  );
}

export default MailboxPanel;
