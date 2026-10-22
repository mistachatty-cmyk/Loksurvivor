/**
 * The Cheat bar: a text box plus one chip per code. Only shown once the master phrase has
 * switched Dev Mode access on (the Settings dev section and LOK Chat both mount it).
 */
import { useState } from 'react';
import { Terminal } from 'lucide-react';

import { CHEAT_CODES, primaryPhrase, type CheatGroup } from '@/game/data/cheatCodes';
import { useT } from '@/lib/i18n';
import { useCheats } from './useCheats';

const GROUPS: { id: CheatGroup; labelKey: 'cheat.group.resources' | 'cheat.group.unlocks' | 'cheat.group.fun' }[] = [
  { id: 'resources', labelKey: 'cheat.group.resources' },
  { id: 'unlocks', labelKey: 'cheat.group.unlocks' },
  { id: 'fun', labelKey: 'cheat.group.fun' },
];

export function CheatBar({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const { run, devAccess } = useCheats();
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');

  if (!devAccess) return null;

  const submit = (text: string) => {
    const outcome = run(text);
    setNote(outcome.handled ? outcome.message : t('cheat.unknown'));
    if (outcome.handled) setDraft('');
  };

  return (
    <div className="border border-cyan-300/30 bg-black/40 p-3" data-testid="cheat-bar">
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); if (draft.trim()) submit(draft); }}>
        <div className="relative min-w-0 flex-1">
          <Terminal className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200/70" aria-hidden="true" />
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t('cheat.placeholder')}
            aria-label={t('cheat.placeholder')}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            data-testid="cheat-input"
            className="min-h-10 w-full border border-white/20 bg-black/50 pl-8 pr-3 text-sm text-white placeholder:text-white/35 focus:border-cyan-200/70 focus:outline-none"
          />
        </div>
        <button type="submit" disabled={!draft.trim()} data-testid="cheat-run" className="min-h-10 border border-cyan-300/50 bg-cyan-400/15 px-4 text-xs font-bold uppercase tracking-wider text-cyan-100 disabled:opacity-40">
          {t('cheat.run')}
        </button>
      </form>
      <p className="mt-2 min-h-[1.25rem] text-xs text-cyan-100/90" role="status" aria-live="polite" data-testid="cheat-note">{note}</p>
      {compact ? null : (
        <div className="mt-2 space-y-2">
          {GROUPS.map((group) => (
            <div key={group.id}>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">{t(group.labelKey)}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {CHEAT_CODES.filter((code) => code.group === group.id).map((code) => (
                  <button
                    key={code.id}
                    type="button"
                    onClick={() => submit(primaryPhrase(code))}
                    data-testid={`cheat-chip-${code.id}`}
                    className="border border-white/15 bg-white/5 px-2 py-1 font-mono text-[11px] text-white/85 hover:border-cyan-200/60"
                  >
                    {primaryPhrase(code)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
