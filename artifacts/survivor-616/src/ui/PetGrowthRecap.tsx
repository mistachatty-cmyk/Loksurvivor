import { ChevronDown } from 'lucide-react';

import { BOND_RANK_BY_ID } from '@/game/engine/petGrowth';
import type { PetGrowthEntry } from '@/game/types';

/**
 * The Growth Recap: one compact line per pet that was out, shown after a run.
 * A collapsible block, so it adds one row to the summary rather than a new panel.
 */
export function PetGrowthRecap({ entries }: { entries: PetGrowthEntry[] }) {
  if (entries.length === 0) return null;
  const levelUps = entries.filter((e) => e.newLevel > e.oldLevel).length;
  return (
    <details open className="group border border-emerald-300/30 bg-card p-4 md:col-span-2" data-testid="section-growth-recap">
      <summary className="flex cursor-pointer list-none items-center gap-2">
        <span className="text-lg text-emerald-300">✦</span>
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Growth recap</span>
        {levelUps > 0 ? <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-200">{levelUps} level-up{levelUps === 1 ? '' : 's'}</span> : null}
        <ChevronDown className="ml-auto h-4 w-4 text-white/40 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <ul className="mt-3 space-y-1.5">
        {entries.map((entry) => {
          const leveled = entry.newLevel > entry.oldLevel;
          const rankUp = entry.newBondRank !== entry.oldBondRank;
          return (
            <li key={entry.petId} className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-white/10 bg-black/25 px-2 py-1.5" data-testid={`growth-recap-${entry.petId}`}>
              <span className="min-w-0 flex-1 truncate text-[11px] font-black uppercase tracking-wide text-white">{entry.name}</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-200">+{entry.expGained.toLocaleString()} XP</span>
              <span className={`font-mono text-[10px] uppercase tracking-wider ${leveled ? 'font-bold text-amber-200' : 'text-white/55'}`}>
                {leveled ? `Lv ${entry.oldLevel} → ${entry.newLevel}` : `Lv ${entry.newLevel}`}
              </span>
              <span className={`font-mono text-[10px] uppercase tracking-wider ${rankUp ? 'font-bold text-pink-200' : 'text-white/55'}`}>
                {entry.bondGained > 0 ? `+${entry.bondGained} bond · ` : ''}{BOND_RANK_BY_ID[entry.newBondRank].label}{rankUp ? ' (new)' : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
